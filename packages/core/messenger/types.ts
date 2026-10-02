// Messenger এর নিজস্ব queue job টাইপ — WhatsApp এর chatbot/types.ts, groups/types.ts থেকে
// ইচ্ছাকৃতভাবে আলাদা ফাইলে, যাতে দুই চ্যানেলের job data ভুলেও একে অপরের সাথে না মিশে যায়।

// একটা raw webhook POST এ Facebook একাধিক messaging event ব্যাচ করে পাঠাতে পারে —
// webhook route প্রতিটাকে আলাদা job হিসেবে "messenger-webhook-events" queue তে বসায়
// (mid থাকলে সেটাই jobId, dedup এর জন্য)
export type MessengerWebhookJobData = {
  pageId: string; // Facebook Page ID (messenger_pages.page_id, uuid না)
  senderPsid: string;
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{ type: string; payload?: { url?: string } }>;
  };
};

// ইনবক্স/বট/অর্ডার-নোটিফিকেশন তিনটারই রিপ্লাই — "messenger-jobs" queue তে "reply" নামে যায়
// (WhatsApp এর chatbot-autoreply queue এর সাথে মেশে না, সম্পূর্ণ আলাদা queue)
export type MessengerReplyJobData = {
  conversationId: string;
  messengerPageId: string; // messenger_pages.id (uuid)
  psid: string;
  replyText: string;
  senderType: "bot" | "agent";
  // true হলে ২৪ ঘণ্টার উইন্ডো শেষ হয়ে গেলেও (কাস্টমারের সর্বশেষ মেসেজের ৭ দিনের মধ্যে)
  // HUMAN_AGENT ট্যাগ দিয়ে পাঠানোর চেষ্টা হবে — শুধু ইনবক্সের ম্যানুয়াল এজেন্ট রিপ্লাইয়ে true।
  // AI বট রিপ্লাই আর অর্ডার-স্ট্যাটাস নোটিফিকেশনে false — উইন্ডো শেষ হলে চুপচাপ পাঠাবে না
  // (প্রোমোশনাল/নোটিফিকেশন-ধর্মী কনটেন্ট tag দিয়ে পাঠানো Meta এর নীতি অনুযায়ী ঠিক না)
  allowHumanAgentTag: boolean;
  // handed_off মার্ক করা দরকার কিনা (AI "needs_human" বললে true) — conversation.status
  // আপডেট করতে ব্যবহার হয়, agent/order-notification রিপ্লাইয়ে সবসময় false
  markHandedOff: boolean;
};

// ইনকামিং ছবি/ফাইল/ভয়েসের Graph attachment URL (মেয়াদ ছোট) ডাউনলোড করে inbox-media bucket এ
// সেভ করার job — মূল মেসেজ ততক্ষণে আগেই সেভ হয়ে গেছে (WhatsApp এর DownloadInboxMediaJobData
// এর ঠিক একই প্যাটার্ন, শুধু "messenger-jobs" queue তে "download-media" নামে)
export type DownloadMessengerMediaJobData = {
  messengerMessageId: string;
  workspaceId: string;
  conversationId: string;
  mediaUrl: string;
};

// Phase M3 — পোস্টের নিচে নতুন কমেন্ট (webhook এর "feed" field) — DM ইভেন্টের ঠিক একই
// "messenger-webhook-events" queue তে যায়, শুধু job name "comment" (DM এর "event" থেকে আলাদা,
// যাতে messengerWebhookWorker সহজে branch করতে পারে)
export type MessengerCommentWebhookJobData = {
  pageId: string; // Facebook Page ID (messenger_pages.page_id, uuid না)
  commentId: string;
  postId: string | null;
  fromPsid: string | null;
  fromName: string | null;
  commentText: string;
};

// ম্যাচ হওয়া রুলের রিপ্লাই পাঠানো — "messenger-jobs" queue তে "comment-reply" নামে।
// action অনুযায়ী প্রসেসর হয় পাবলিক কমেন্ট রিপ্লাই করবে, নয়তো Private Reply (psid লাগবে,
// তাই fromPsid প্রয়োজনীয় যখন action="private_reply")
export type MessengerCommentReplyJobData = {
  commentId: string;
  messengerPageId: string;
  postId: string | null;
  fromPsid: string | null;
  action: "public_reply" | "private_reply";
  replyText: string;
  // কবে queue তে বসানো হয়েছিল (ISO string) — send করার ঠিক আগে staleness চেক করতে (drip delay
  // ছাড়াও infra backlog এর কারণে দেরি হলে সেটাও ধরা পড়ে, reason=queue_expired)
  queuedAt: string;
  // "স্কিপড কমেন্ট" পেজ থেকে ম্যানুয়ালি "এখন পাঠান" চাপলে সেই skip row এর id — সফল হলে ওই
  // row.status "sent_manually" এ আপডেট হয়
  skipId?: string;
};
