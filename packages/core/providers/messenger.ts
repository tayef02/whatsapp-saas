import type { MessengerProvider, MessengerPageInfo } from "./messenger-types";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const DEFAULT_TIMEOUT_MS = 15_000;

interface MessengerAppConfig {
  appId: string;
  appSecret: string;
}

// fetch() ব্যর্থ হলে (network/timeout) আসল কারণ err.cause এ থাকে, সেটা বের করে মেসেজে
// জুড়ে দেওয়া হচ্ছে — Evolution provider এর ঠিক একই প্যাটার্ন (evolution.ts দেখুন)। কোনো
// token/secret এই এরর মেসেজে থাকে না (fetch কল গুলোতে token সবসময় query param/body তে
// যায়, কখনো এই ফাংশনের বাইরে লগ হয় না)।
async function safeFetch(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const cause = err instanceof Error ? (err.cause as { code?: string; name?: string; message?: string } | undefined) : undefined;
    const causeInfo = cause ? ` — cause: ${cause.code ?? cause.name ?? "?"} ${cause.message ?? ""}`.trim() : "";
    const baseMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Messenger Graph API রিকোয়েস্ট ব্যর্থ (timeout=${timeoutMs}ms): ${baseMessage}${causeInfo}`);
  }
}

async function parseGraphError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string; type?: string; code?: number } };
    return body.error?.message ? `${body.error.message} (type=${body.error.type}, code=${body.error.code})` : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export class MetaMessengerProvider implements MessengerProvider {
  constructor(private config: MessengerAppConfig) {}

  getOAuthDialogUrl(redirectUri: string, state: string): string {
    // pages_manage_engagement — M3 তে কমেন্ট রিপ্লাই করতে লাগে (পরে M5 তে হাইড/ডিলিটেও লাগবে)।
    // pages_read_user_content — কমেন্ট/রিভিউ এর মতো অন্য ইউজারের (পেজ নিজে নয়) পোস্ট করা কনটেন্ট
    // পড়তে লাগে, যা ছাড়া webhook এর "feed" ইভেন্টে কমেন্টের লেখা/from অসম্পূর্ণ বা অনুপস্থিত
    // থাকতে পারে। ⚠️ এই permission গুলো আসলেই যথেষ্ট কিনা Meta App Review submission এর সময়
    // Meta এর সর্বশেষ ডকুমেন্টেশনের সাথে মিলিয়ে একবার যাচাই করে নেওয়া ভালো।
    // নোট: scope বদলালে আগে-কানেক্ট-করা পেজের token পুরনো permission দিয়েই ইস্যু করা থাকে —
    // নতুন scope কার্যকর হতে সেই পেজ আবার কানেক্ট (ডিসকানেক্ট করে OAuth আবার) করতে হবে, শুধু
    // webhook রিফ্রেশ যথেষ্ট না।
    const scope = [
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
      "pages_read_engagement",
      "pages_manage_engagement",
      "pages_read_user_content",
      "business_management",
    ].join(",");
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: redirectUri,
      scope,
      state,
      response_type: "code",
    });
    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForUserToken(code: string, redirectUri: string): Promise<{ userAccessToken: string }> {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: redirectUri,
      client_secret: this.config.appSecret,
      code,
    });
    const res = await safeFetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`Facebook কোড এক্সচেঞ্জ ব্যর্থ: ${await parseGraphError(res)}`);
    const data = (await res.json()) as { access_token: string };
    return { userAccessToken: data.access_token };
  }

  async getLongLivedUserToken(shortLivedToken: string): Promise<{ userAccessToken: string }> {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedToken,
    });
    const res = await safeFetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`Facebook long-lived token এক্সচেঞ্জ ব্যর্থ: ${await parseGraphError(res)}`);
    const data = (await res.json()) as { access_token: string };
    return { userAccessToken: data.access_token };
  }

  async listPages(userAccessToken: string): Promise<MessengerPageInfo[]> {
    const params = new URLSearchParams({ access_token: userAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/me/accounts?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`পেজ তালিকা আনা ব্যর্থ: ${await parseGraphError(res)}`);
    const data = (await res.json()) as { data: Array<{ id: string; name: string; access_token: string }> };
    return data.data.map((p) => ({ pageId: p.id, pageName: p.name, pageAccessToken: p.access_token }));
  }

  async subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
    // "feed" — M3 তে পোস্টের কমেন্ট ইভেন্ট পেতে যোগ হয়েছে। আগে কানেক্ট হওয়া পেজে এই নতুন
    // field পেতে আবার সাবস্ক্রাইব কল করা লাগবে — তাই PageCard.tsx তে "ওয়েবহুক রিফ্রেশ করুন"
    // বাটন (WhatsApp Groups পেজের একই প্যাটার্ন)
    const params = new URLSearchParams({
      subscribed_fields: "messages,messaging_postbacks,feed",
      access_token: pageAccessToken,
    });
    const res = await safeFetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps?${params.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(`Webhook সাবস্ক্রাইব ব্যর্থ: ${await parseGraphError(res)}`);
  }

  async unsubscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps?${params.toString()}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Webhook আনসাবস্ক্রাইব ব্যর্থ: ${await parseGraphError(res)}`);
  }

  // GET /{page-id}/subscribed_apps — Meta আসলে কোন ফিল্ডে এই পেজের জন্য আমাদের App কে
  // সাবস্ক্রাইব করে রেখেছে তার সত্যিকারের অবস্থা (subscribePageWebhook() এর POST কল সফল
  // হওয়া শুধু বোঝায় রিকোয়েস্ট গ্রহণ হয়েছে, Meta আসলে কী রেখেছে সেটা না)। একাধিক App
  // সাবস্ক্রাইব থাকলেও (সাধারণত থাকে না, এই page token শুধু আমাদের App এর) সব এন্ট্রির
  // fields মিলিয়ে ডিডুপ করা হচ্ছে, যাতে কোনো ফিল্ড মিস না হয়ে যায়
  async getSubscribedFields(pageId: string, pageAccessToken: string): Promise<string[]> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`সাবস্ক্রিপশন তথ্য আনা ব্যর্থ: ${await parseGraphError(res)}`);
    const data = (await res.json()) as { data?: Array<{ subscribed_fields?: string[] }> };
    const fields = new Set<string>();
    for (const entry of data.data ?? []) {
      for (const field of entry.subscribed_fields ?? []) fields.add(field);
    }
    return Array.from(fields);
  }

  async sendMessage(
    pageAccessToken: string,
    psid: string,
    text: string,
    messagingType: "RESPONSE" | "MESSAGE_TAG",
    tag?: "HUMAN_AGENT"
  ): Promise<{ messageId: string }> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const body: Record<string, unknown> = {
      recipient: { id: psid },
      messaging_type: messagingType,
      message: { text },
    };
    if (messagingType === "MESSAGE_TAG" && tag) body.tag = tag;

    const res = await safeFetch(`${GRAPH_API_BASE}/me/messages?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const message = await parseGraphError(res);
      const err = new Error(`Messenger এ মেসেজ পাঠানো ব্যর্থ: ${message}`) as Error & { isAuthError?: boolean; isTagError?: boolean };
      // OAuthException (code 190) বা "Error validating access token" — এই দুইটাই মূলত token
      // মেয়াদ শেষ/রিভোক হওয়ার সংকেত, ডাটাবেসে status="token_expired" সেট করার জন্য এটা flag করা
      err.isAuthError = res.status === 401 || message.includes("OAuthException");
      // HUMAN_AGENT ট্যাগ Meta App Review approve না করলে একটা permission/tag-সংক্রান্ত এরর
      // আসে — Meta এর exact এরর টেক্সট ডকুমেন্টেড না, তাই heuristic (code 10, বা মেসেজে
      // "tag"/"permission" শব্দ) দিয়ে ধরা হচ্ছে (process-messenger-reply.ts এই ফ্ল্যাগ দেখে
      // ইউজারকে বাংলায় বুঝিয়ে নোটিফিকেশন দেয়, raw এরর সবসময় লগ হয়)
      if (messagingType === "MESSAGE_TAG") {
        const lower = message.toLowerCase();
        err.isTagError = message.includes("code=10") || lower.includes("tag") || lower.includes("permission");
      }
      throw err;
    }
    const data = (await res.json()) as { message_id: string };
    return { messageId: data.message_id };
  }

  async sendTypingOn(pageAccessToken: string, psid: string): Promise<void> {
    try {
      const params = new URLSearchParams({ access_token: pageAccessToken });
      await safeFetch(
        `${GRAPH_API_BASE}/me/messages?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { id: psid }, sender_action: "typing_on" }),
        },
        8_000
      );
    } catch {
      // কসমেটিক — ব্যর্থ হলেও মূল মেসেজ পাঠানো আটকানো উচিত না
    }
  }

  async getUserProfile(pageAccessToken: string, psid: string): Promise<{ name: string | null }> {
    try {
      const params = new URLSearchParams({ fields: "name", access_token: pageAccessToken });
      const res = await safeFetch(`${GRAPH_API_BASE}/${psid}?${params.toString()}`, { method: "GET" }, 8_000);
      if (!res.ok) return { name: null };
      const data = (await res.json()) as { name?: string };
      return { name: data.name ?? null };
    } catch {
      // প্রোফাইল নাম না পাওয়া গেলে পুরো মেসেজ প্রসেসিং আটকানো ঠিক না — চুপচাপ null
      return { name: null };
    }
  }

  async replyToComment(pageAccessToken: string, commentId: string, text: string): Promise<{ commentId: string }> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/${commentId}/comments?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const message = await parseGraphError(res);
      const err = new Error(`কমেন্টে রিপ্লাই পাঠানো ব্যর্থ: ${message}`) as Error & { isAuthError?: boolean };
      err.isAuthError = res.status === 401 || message.includes("OAuthException");
      throw err;
    }
    const data = (await res.json()) as { id: string };
    return { commentId: data.id };
  }

  // Private Reply — recipient এ psid এর বদলে comment_id (Meta এর ডকুমেন্টেড পদ্ধতি, এই পথেই
  // কাস্টমার কখনো DM না করলেও প্রথম মেসেজ পাঠানো যায়)। ⚠️ এই endpoint/shape Meta এর
  // ডকুমেন্টেশন অনুযায়ী লেখা, লাইভে প্রথমবার টেস্ট করার সময় যাচাই করে নেওয়া ভালো।
  async sendPrivateReply(pageAccessToken: string, commentId: string, text: string): Promise<{ messageId: string }> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/me/messages?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    });
    if (!res.ok) {
      const message = await parseGraphError(res);
      const err = new Error(`Private Reply পাঠানো ব্যর্থ: ${message}`) as Error & { isAuthError?: boolean };
      err.isAuthError = res.status === 401 || message.includes("OAuthException");
      throw err;
    }
    const data = (await res.json()) as { message_id: string };
    return { messageId: data.message_id };
  }
}
