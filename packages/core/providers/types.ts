// সব WhatsApp provider (Evolution, পরে Meta Cloud API) এই একই interface মানবে।
// web আর worker দুটোই এই ফাইল থেকে import করবে।

export type ConnectionStatus = "connecting" | "online" | "offline" | "banned";

export interface CreateInstanceResult {
  instanceName: string;
  qrCodeBase64: string | null;
}

export interface WhatsAppProvider {
  // webhookUrl দিলে প্রতিটা instance তার নিজের webhook নিয়ে বসবে (শেয়ার্ড Evolution সার্ভারে
  // গ্লোবাল webhook বদলানো ছাড়াই) — প্রোডাকশনে এটা বাধ্যতামূলক, কারণ একই সার্ভারে অন্য অ্যাপের
  // instance ও থাকতে পারে
  createInstance(instanceName: string, webhookUrl?: string): Promise<CreateInstanceResult>;
  getStatus(instanceName: string): Promise<ConnectionStatus>;
  disconnect(instanceName: string): Promise<void>;
  sendMessage(instanceName: string, to: string, text: string): Promise<{ messageId: string }>;
  sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    mediaType: "image" | "document",
    mimeType: string,
    caption: string
  ): Promise<{ messageId: string }>;
}
