import type { ConnectionStatus, CreateInstanceResult, WhatsAppProvider } from "./types";

interface EvolutionServerConfig {
  apiUrl: string;
  apiKey: string;
}

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
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"],
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
