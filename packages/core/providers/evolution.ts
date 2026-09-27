import type { ConnectionStatus, CreateInstanceResult, GroupInfo, GroupMessageKey, WhatsAppProvider } from "./types";

interface EvolutionServerConfig {
  apiUrl: string;
  apiKey: string;
}

// createInstance আর setWebhook দুটোই এই একই লিস্ট ব্যবহার করে, যাতে নতুন ইভেন্ট টাইপ যোগ
// করার সময় দুই জায়গায় আলাদাভাবে আপডেট করা লাগে না এবং কখনো একটার সাথে আরেকটা মিসম্যাচ না হয়
const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
  "GROUP_PARTICIPANTS_UPDATE",
];

const DEFAULT_TIMEOUT_MS = 30_000;
// মিডিয়া পাঠাতে Evolution কে নিজে media URL থেকে ডাউনলোড+আপলোড করতে হয়, টেক্সটের চেয়ে
// বেশি সময় লাগতে পারে (বিশেষ করে Evolution সবে রিস্টার্ট হওয়ার পর সেশন গরম হচ্ছে থাকলে)
const MEDIA_TIMEOUT_MS = 60_000;

// Evolution API (self-hosted) এর জন্য WhatsAppProvider এর ইমপ্লিমেন্টেশন।
// পরে EvolutionProvider এর মতোই একটা MetaProvider ক্লাস বানিয়ে একই interface মানলেই হবে।
export class EvolutionProvider implements WhatsAppProvider {
  constructor(private server: EvolutionServerConfig) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      apikey: this.server.apiKey,
    };
  }

  // fetch() ব্যর্থ হলে Node/undici একটা generic "fetch failed" এরর দেয়, আসল কারণ
  // (connection refused, timeout, DNS ইত্যাদি) থাকে err.cause এ — এখানে সেটা বের করে
  // মেসেজে জুড়ে দেওয়া হয় যাতে worker এর লগে ঠিক জায়গাটা বোঝা যায়। URL এ apikey থাকে না
  // (হেডারে পাঠানো হয়), তাই সরাসরি লগ করা নিরাপদ।
  private async request(path: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
    const url = `${this.server.apiUrl}${path}`;
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const cause = err instanceof Error ? (err.cause as { code?: string; name?: string; message?: string } | undefined) : undefined;
      const causeInfo = cause ? ` — cause: ${cause.code ?? cause.name ?? "?"} ${cause.message ?? ""}`.trim() : "";
      const baseMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Evolution API রিকোয়েস্ট ব্যর্থ (url=${url}, timeout=${timeoutMs}ms): ${baseMessage}${causeInfo}`);
    }
  }

  async createInstance(instanceName: string, webhookUrl?: string): Promise<CreateInstanceResult> {
    const res = await this.request(`/instance/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        // instance-লেভেল webhook — শেয়ার্ড Evolution সার্ভারে অন্য instance এর গ্লোবাল
        // webhook স্পর্শ না করেই শুধু এই instance এর ইভেন্ট আমাদের অ্যাপে আসবে
        ...(webhookUrl && {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: WEBHOOK_EVENTS,
          },
        }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution createInstance ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return {
      instanceName,
      qrCodeBase64: data?.qrcode?.base64 ?? null,
    };
  }

  // নতুন ইভেন্ট টাইপ (যেমন GROUP_PARTICIPANTS_UPDATE) যোগ হলে ইতিমধ্যে কানেক্টেড থাকা নাম্বারগুলো
  // আবার QR স্ক্যান/রিকানেক্ট না করেই আপডেটেড ইভেন্ট লিস্ট পেতে এটা কল করা যায়। VPS এ লাইভ টেস্ট
  // করে ধরা পড়েছে: এই এন্ডপয়েন্ট "enabled" ফিল্ড ছাড়া 400 এরর দেয় (createInstance-এর webhook
  // অবজেক্টে এটা optional মনে হলেও এখানে required)
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    const res = await this.request(`/webhook/set/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: WEBHOOK_EVENTS,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution setWebhook ব্যর্থ (${res.status}): ${body}`);
    }
  }

  async getStatus(instanceName: string): Promise<ConnectionStatus> {
    const res = await this.request(`/instance/connectionState/${instanceName}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      return "offline";
    }

    const data = (await res.json()) as any;
    const state = data?.instance?.state as string | undefined;

    if (state === "open") return "online";
    if (state === "connecting") return "connecting";
    return "offline";
  }

  async disconnect(instanceName: string): Promise<void> {
    await this.request(`/instance/logout/${instanceName}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }

  async sendMessage(instanceName: string, to: string, text: string) {
    const res = await this.request(`/message/sendText/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ number: to, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution sendMessage ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return { messageId: data?.key?.id ?? "" };
  }

  // ব্যর্থ হলেও এখানেই ধরে ফেলা হয় (throw করা হয় না) — টাইপিং ইন্ডিকেটর না দেখানো গেলেও
  // আসল মেসেজ পাঠানো যেন কখনো আটকে না যায়
  async sendPresence(instanceName: string, to: string, presence: "composing" | "paused"): Promise<void> {
    try {
      const res = await this.request(`/chat/sendPresence/${instanceName}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ number: to, presence, delay: 1200 }),
      });
      if (!res.ok) {
        console.log(`[evolution] sendPresence non-ok status ${res.status} (instance=${instanceName})`);
      }
    } catch (err) {
      console.log(`[evolution] sendPresence failed, non-critical: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Evolution API v2 এর ডকুমেন্টেড কনভেনশন অনুযায়ী এন্ডপয়েন্ট — sendMessage/createInstance এর
  // মতো VPS এর আসল ইনস্ট্যান্সে যাচাই করা হয়নি এখনো, তাই প্রথমবার লাইভ গ্রুপে টেস্ট করে দেখা জরুরি
  async listGroups(instanceName: string): Promise<GroupInfo[]> {
    const res = await this.request(`/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution listGroups ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any[];
    return (data ?? []).map((g) => ({
      groupJid: g.id as string,
      name: (g.subject as string) ?? "",
      description: (g.desc as string) ?? null,
      participants: ((g.participants as any[]) ?? []).map((p) => ({
        jid: p.id as string,
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
      })),
    }));
  }

  async getGroupInviteCode(instanceName: string, groupJid: string): Promise<string> {
    const res = await this.request(`/group/inviteCode/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution getGroupInviteCode ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return (data?.inviteCode as string) ?? "";
  }

  async revokeGroupInviteCode(instanceName: string, groupJid: string): Promise<string> {
    // VPS এ লাইভ টেস্ট করে ধরা পড়েছে: এই এন্ডপয়েন্ট PUT না, POST নেয় (PUT দিলে 404
    // "Cannot PUT" — Evolution এর রাউটার এই path টা POST মেথডে রেজিস্টার করে রেখেছে)
    const res = await this.request(`/group/revokeInviteCode/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`, {
      method: "POST",
      headers: this.headers(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution revokeGroupInviteCode ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return (data?.inviteCode as string) ?? "";
  }

  // Evolution v2 এর ডকুমেন্টেড কনভেনশন অনুযায়ী এন্ডপয়েন্ট — group এন্ডপয়েন্টগুলোর মতোই
  // VPS এ লাইভ যাচাই করা হয়নি, প্রথমবার টেস্ট করার সময় path/মেথড ভুল হলে এরর বডি দেখে ঠিক
  // করা যাবে (আগের revokeInviteCode এর মতোই)
  async deleteGroupMessage(instanceName: string, groupJid: string, key: GroupMessageKey): Promise<void> {
    const res = await this.request(`/chat/deleteMessageForEveryone/${instanceName}`, {
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({
        id: key.id,
        remoteJid: groupJid,
        fromMe: key.fromMe,
        participant: key.participant,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution deleteGroupMessage ব্যর্থ (${res.status}): ${body}`);
    }
  }

  // ওয়েব সার্চ করে যাচাই করা এন্ডপয়েন্ট (Evolution v2 এর নিজস্ব ডকুমেন্টেশন) — raw message এর
  // url ফিল্ড দিয়ে সরাসরি ডাউনলোড করলে এনক্রিপ্টেড বাইনারি আসে (WhatsApp মিডিয়া mediaKey দিয়ে
  // এনক্রিপ্ট করা থাকে), এই এন্ডপয়েন্ট Evolution এর ভেতরেই ডিক্রিপ্ট করে base64 রিটার্ন করে
  async getMediaBase64(instanceName: string, messageId: string): Promise<{ base64: string; mimetype: string; fileName: string } | null> {
    const res = await this.request(
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ message: { key: { id: messageId } } }),
      },
      MEDIA_TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution getMediaBase64 ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    if (!data?.base64) return null;

    return {
      base64: data.base64 as string,
      mimetype: (data.mimetype as string) ?? "application/octet-stream",
      fileName: (data.fileName as string) ?? messageId,
    };
  }

  // ওয়েব সার্চ করে যাচাই করা এন্ডপয়েন্ট (Evolution v2 এর নিজস্ব ডকুমেন্টেশন)
  async sendPoll(instanceName: string, to: string, question: string, options: string[], multiSelect: boolean) {
    const res = await this.request(`/message/sendPoll/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        number: to,
        name: question,
        selectableCount: multiSelect ? options.length : 1,
        values: options,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution sendPoll ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return { messageId: data?.key?.id ?? "" };
  }

  // Evolution v2 এর ডকুমেন্টেড কনভেনশন অনুযায়ী এন্ডপয়েন্ট/পেলোড — এখনো VPS এ লাইভ যাচাই করা
  // হয়নি। "announcement" মোড চালু = শুধু অ্যাডমিন পোস্ট করতে পারবে (Baileys এর
  // groupSettingUpdate(jid, 'announcement'|'not_announcement') এর সমতুল্য)
  async setGroupAdminOnlyMode(instanceName: string, groupJid: string, adminOnly: boolean): Promise<void> {
    const res = await this.request(`/group/updateSetting/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ action: adminOnly ? "announcement" : "not_announcement" }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution setGroupAdminOnlyMode ব্যর্থ (${res.status}): ${body}`);
    }
  }

  async sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    mediaType: "image" | "document",
    mimeType: string,
    caption: string
  ) {
    const res = await this.request(
      `/message/sendMedia/${instanceName}`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          number: to,
          mediatype: mediaType,
          mimetype: mimeType,
          media: mediaUrl,
          caption,
          fileName: mediaType === "document" ? "attachment.pdf" : undefined,
        }),
      },
      MEDIA_TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution sendMedia ব্যর্থ (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;
    return { messageId: data?.key?.id ?? "" };
  }
}
