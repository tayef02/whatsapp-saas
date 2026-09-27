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
// bot গ্রুপে অ্যাডমিন কিনা নিশ্চিত হয়েই শুধু এই job বসানো হয়, তাই worker এখানে permission
// চেক করে না, সরাসরি delete কল করে
export type DeleteGroupMessageJobData = {
  workspaceId: string;
  whatsappNumberId: string;
  groupJid: string;
  messageId: string;
  senderPhone: string;
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
