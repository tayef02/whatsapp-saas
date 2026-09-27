// গ্রুপ কিওয়ার্ড অটো-রিপ্লাই পাঠানোর job — web আর worker দুটোই ব্যবহার করে,
// একই chatbot-autoreply queue তে "group-reply" নামে যায় (1:1 chat এর "reply" থেকে আলাদা)
export type GroupReplyJobData = {
  workspaceId: string;
  whatsappNumberId: string;
  groupJid: string;
  replyText: string;
};
