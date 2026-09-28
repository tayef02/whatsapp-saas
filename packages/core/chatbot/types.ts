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
