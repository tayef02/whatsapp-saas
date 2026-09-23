import type { ConnectionStatus, CreateInstanceResult, WhatsAppProvider } from "./types";

interface EvolutionServerConfig {
  apiUrl: string;
  apiKey: string;
}

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

  async createInstance(instanceName: string): Promise<CreateInstanceResult> {
    const res = await fetch(`${this.server.apiUrl}/instance/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution createInstance ব্যর্থ (${res.status}): ${body}`);
    }

    const data = await res.json();
    return {
      instanceName,
      qrCodeBase64: data?.qrcode?.base64 ?? null,
    };
  }

  async getStatus(instanceName: string): Promise<ConnectionStatus> {
    const res = await fetch(`${this.server.apiUrl}/instance/connectionState/${instanceName}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      return "offline";
    }

    const data = await res.json();
    const state = data?.instance?.state as string | undefined;

    if (state === "open") return "online";
    if (state === "connecting") return "connecting";
    return "offline";
  }

  async disconnect(instanceName: string): Promise<void> {
    await fetch(`${this.server.apiUrl}/instance/logout/${instanceName}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }

  async sendMessage(instanceName: string, to: string, text: string) {
    const res = await fetch(`${this.server.apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ number: to, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution sendMessage ব্যর্থ (${res.status}): ${body}`);
    }

    const data = await res.json();
    return { messageId: data?.key?.id ?? "" };
  }
}
