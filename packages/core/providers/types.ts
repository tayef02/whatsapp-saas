// সব WhatsApp provider (Evolution, পরে Meta Cloud API) এই একই interface মানবে।
// web আর worker দুটোই এই ফাইল থেকে import করবে।

export type ConnectionStatus = "connecting" | "online" | "offline" | "banned";

export interface CreateInstanceResult {
  instanceName: string;
  qrCodeBase64: string | null;
}

export interface GroupParticipant {
  jid: string;
  isAdmin: boolean;
}

export interface GroupInfo {
  groupJid: string;
  name: string;
  description: string | null;
  participants: GroupParticipant[];
}

export interface GroupMessageKey {
  id: string;
  participant?: string;
  fromMe: boolean;
}

export interface WhatsAppProvider {
  // webhookUrl দিলে প্রতিটা instance তার নিজের webhook নিয়ে বসবে (শেয়ার্ড Evolution সার্ভারে
  // গ্লোবাল webhook বদলানো ছাড়াই) — প্রোডাকশনে এটা বাধ্যতামূলক, কারণ একই সার্ভারে অন্য অ্যাপের
  // instance ও থাকতে পারে
  createInstance(instanceName: string, webhookUrl?: string): Promise<CreateInstanceResult>;
  // ইতিমধ্যে কানেক্টেড থাকা instance এর webhook ইভেন্ট লিস্ট আপডেট করার জন্য (নতুন ইভেন্ট টাইপ
  // যোগ হলে রিকানেক্ট ছাড়াই আপডেটেড লিস্ট পেতে)
  setWebhook(instanceName: string, webhookUrl: string): Promise<void>;
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
  // রিপ্লাই পাঠানোর ঠিক আগে "টাইপ করছে..." দেখানোর জন্য — এটা শুধু কসমেটিক (মানুষ-এজেন্টের
  // মতো অনুভূতি দেয়), ব্যর্থ হলেও মূল sendMessage আটকানো উচিত না
  sendPresence(instanceName: string, to: string, presence: "composing" | "paused"): Promise<void>;
  // গ্রুপ টুলস (Phase ২) — গ্রুপ লিস্ট + মেম্বার/অ্যাডমিন sync, ইনভাইট লিংক জেনারেট/রোটেট
  listGroups(instanceName: string): Promise<GroupInfo[]>;
  getGroupInviteCode(instanceName: string, groupJid: string): Promise<string>;
  revokeGroupInviteCode(instanceName: string, groupJid: string): Promise<string>;
  // চালু করলে শুধু গ্রুপ অ্যাডমিনরাই মেসেজ পাঠাতে পারবে (WhatsApp এর "announcement" গ্রুপ মোড)
  setGroupAdminOnlyMode(instanceName: string, groupJid: string, adminOnly: boolean): Promise<void>;
  // স্প্যাম/ব্যানড-ওয়ার্ড ফিল্টার ম্যাচ হলে (আর bot গ্রুপে অ্যাডমিন হলে) মেসেজ auto-delete করতে
  deleteGroupMessage(instanceName: string, groupJid: string, key: GroupMessageKey): Promise<void>;
  // মিডিয়া মেসেজ (ছবি/ভিডিও/ডকুমেন্ট/অডিও) এর আসল ফাইল ডিক্রিপ্ট করা base64 হিসেবে আনতে —
  // raw message এর url ফিল্ড দিয়ে সরাসরি ডাউনলোড করলে এনক্রিপ্টেড ডেটা আসে, Evolution এর এই
  // এন্ডপয়েন্টই ডিক্রিপশন হ্যান্ডল করে
  getMediaBase64(
    instanceName: string,
    messageId: string
  ): Promise<{ base64: string; mimetype: string; fileName: string } | null>;
}
