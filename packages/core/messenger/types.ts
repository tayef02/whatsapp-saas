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

// ইনবক্স থেকে এজেন্টের রিপ্লাই — "messenger-jobs" queue তে "reply" নামে যায় (WhatsApp এর
// chatbot-autoreply queue এর সাথে মেশে না, সম্পূর্ণ আলাদা queue)
export type MessengerReplyJobData = {
  conversationId: string;
  messengerPageId: string; // messenger_pages.id (uuid)
  psid: string;
  replyText: string;
};
