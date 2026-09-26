// keyword rule ম্যাচ হলে (বা fallback message) আসল পাঠানোটা এই queue দিয়ে যায় —
// webhook handler কখনো সরাসরি Evolution কল করে না
export const AUTOREPLY_QUEUE_NAME = "chatbot-autoreply";
