// worker আর web দুটোই এই টাইপ ব্যবহার করে — web থেকে এজেন্ট ম্যানুয়াল রিপ্লাই দিলেও
// একই queue/processor দিয়ে যায় (কখনো Next.js থেকে সরাসরি Evolution কল না)
export type AutoReplyJobData = {
  conversationId: string;
  workspaceId: string;
  whatsappNumberId: string;
  phone: string;
  replyText: string;
  // fallback_message পাঠানোর ক্ষেত্রে true — পাঠানোর পর conversation handed_off এ যাবে
  markHandedOff: boolean;
  senderType?: "bot" | "agent";
};

// কনভারসেশন নেই এমন কাস্টমারকে (যেমন গ্রুপ থেকে regex দিয়ে ক্যাপচার করা structured অর্ডারের
// কাস্টমার — কখনো বটের সাথে ১:১ চ্যাট করেনি, তাই কোনো conversations row নেই) সরাসরি ফোন
// নাম্বারে মেসেজ পাঠানোর জন্য — conversation_messages এ কিছু লগ হয় না, শুধু sendMessage কল হয়
export type DirectMessageJobData = {
  whatsappNumberId: string;
  phone: string;
  replyText: string;
};

// ১:১ ইনবক্সে কাস্টমারের পাঠানো ছবি/ভিডিও/অডিও/ডকুমেন্ট ধরা পড়লে ("download-inbox-media"
// নামে একই chatbot-autoreply queue তে যায়) — আসল ফাইল ডাউনলোড+ডিক্রিপ্ট করে inbox-media
// bucket এ সেভ করে conversation_messages.media_path আপডেট করা হয় (group এর
// DownloadGroupMediaJobData/process-group-media.ts এর ঠিক একই প্যাটার্ন)
export type DownloadInboxMediaJobData = {
  conversationMessageId: string;
  workspaceId: string;
  conversationId: string;
  whatsappNumberId: string;
  messageId: string;
};
