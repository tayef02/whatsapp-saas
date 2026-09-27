// গ্রুপ কিওয়ার্ড অটো-রিপ্লাই পাঠানোর job — web আর worker দুটোই ব্যবহার করে,
// একই chatbot-autoreply queue তে "group-reply" নামে যায় (1:1 chat এর "reply" থেকে আলাদা)
export type GroupReplyJobData = {
  workspaceId: string;
  whatsappNumberId: string;
  // AI মোডে outbound রিপ্লাই group_messages এ লগ করার জন্য দরকার (future context এর জন্য)
  groupId: string;
  groupJid: string;
  replyText: string;
};

// স্প্যাম/ব্যানড-ওয়ার্ড/লিংক ফিল্টার ম্যাচ হলে ("delete-group-message" নামে একই queue তে যায়) —
// bot অ্যাডমিন কিনা প্রি-চেক করা হয় না (WhatsApp LID এর কারণে অনির্ভরযোগ্য), সরাসরি delete
// কল করা হয় এবং WhatsApp/Evolution নিজেই পারমিশন না থাকলে এরর দেয়
export type DeleteGroupMessageJobData = {
  workspaceId: string;
  whatsappNumberId: string;
  groupJid: string;
  messageId: string;
  senderPhone: string;
  // আসল key.participant JID হুবহু (phone-JID বা @lid, যেটাই এসেছিল) — WhatsApp এর LID
  // প্রাইভেসি সিস্টেমের কারণে এটা phone নাম্বার থেকে পুনর্গঠন করা ভুল/অনির্ভরযোগ্য (mention
  // ফিচারে একবার এই একই কারণে বাগ হয়েছিল), তাই মূল JID সরাসরি রাখা হচ্ছে
  participantJid: string | undefined;
  matchedText: string;
};

// মিডিয়া মেসেজ ধরা পড়লে ("download-group-media" নামে একই queue তে যায়) — আসল ফাইল
// ডাউনলোড+ডিক্রিপ্ট করে storage এ সেভ করে group_messages.media_url আপডেট করা হয়
export type DownloadGroupMediaJobData = {
  groupMessageRowId: string;
  workspaceId: string;
  groupId: string;
  whatsappNumberId: string;
  messageId: string;
};

// শিডিউলড অ্যানাউন্সমেন্ট/পোলের একটা টার্গেট গ্রুপে পাঠানোর job ("send-group-announcement"
// নামে একই queue তে যায়) — scheduler tick প্রতিটা টার্গেটের জন্য staggered delay দিয়ে বসায়
export type SendGroupAnnouncementJobData = {
  targetId: string;
  whatsappNumberId: string;
  groupJid: string;
  messageText: string;
  pollOptions: string[] | null;
  pollMultiSelect: boolean;
};
