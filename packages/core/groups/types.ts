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
