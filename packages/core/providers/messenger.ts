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
    const scope = ["pages_show_list", "pages_manage_metadata", "pages_messaging", "pages_read_engagement", "business_management"].join(",");
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
    const params = new URLSearchParams({
      subscribed_fields: "messages,messaging_postbacks",
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

  async sendMessage(pageAccessToken: string, psid: string, text: string, messagingType: "RESPONSE"): Promise<{ messageId: string }> {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    const res = await safeFetch(`${GRAPH_API_BASE}/me/messages?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: messagingType,
        message: { text },
      }),
    });
    if (!res.ok) {
      const message = await parseGraphError(res);
      const err = new Error(`Messenger এ মেসেজ পাঠানো ব্যর্থ: ${message}`) as Error & { isAuthError?: boolean };
      // OAuthException (code 190) বা "Error validating access token" — এই দুইটাই মূলত token
      // মেয়াদ শেষ/রিভোক হওয়ার সংকেত, ডাটাবেসে status="token_expired" সেট করার জন্য এটা flag করা
      err.isAuthError = res.status === 401 || message.includes("OAuthException");
      throw err;
    }
    const data = (await res.json()) as { message_id: string };
    return { messageId: data.message_id };
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
}
