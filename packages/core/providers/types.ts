// সব WhatsApp provider (Evolution, পরে Meta Cloud API) এই একই interface মানবে।
// web আর worker দুটোই এই ফাইল থেকে import করবে।

export type ConnectionStatus = "connecting" | "online" | "offline" | "banned";

export interface CreateInstanceResult {
  instanceName: string;
  qrCodeBase64: string | null;
}

export interface WhatsAppProvider {
  createInstance(instanceName: string): Promise<CreateInstanceResult>;
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
