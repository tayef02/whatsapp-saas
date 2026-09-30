// Messenger চ্যানেলের জন্য আলাদা ইন্টারফেস — WhatsAppProvider (evolution.ts, types.ts) এর
// সাথে সরাসরি মেলে না, তাই implement করারও দরকার নেই। কারণ:
//   - WhatsAppProvider এ গ্রুপ (JID), পোল, admin-only mode এর মতো মেথড আছে যেগুলোর
//     Messenger এ কোনো সমতুল্য নেই (Facebook পেজে "গ্রুপ" বলে কিছু নেই)
//   - Messenger এর নিজস্ব concept আছে যেগুলোর WhatsApp এ সমতুল্য নেই (কমেন্ট রিপ্লাই/হাইড,
//     পোস্ট পাবলিশ/শিডিউল, ২৪-ঘণ্টা মেসেজিং উইন্ডো + message tag)
// Phase M0: শুধু টাইপ/ইন্টারফেস (কাঠামো) — কোনো implementation class এখনো নেই, সেটা M1 এ
// (পেজ কানেক্ট + webhook এর আসল লজিকের সাথে) আসবে।

export type MessengerPageStatus = "active" | "token_expired" | "disconnected";

export interface MessengerProvider {
  // পেজ কানেক্ট (M1) — Facebook Login for Business দিয়ে OAuth কোড এক্সচেঞ্জ করে
  // long-lived Page Access Token আনা, Vault এ সেভ করা
  exchangeCodeForPageToken(code: string, redirectUri: string): Promise<{ pageId: string; pageName: string; pageAccessToken: string }>;

  // ইনবক্স (M2) — কাস্টমারকে মেসেজ পাঠানো, ২৪ ঘণ্টা উইন্ডোর বাইরে হলে messageTag লাগবে
  sendMessage(
    pageAccessToken: string,
    psid: string,
    text: string,
    messageTag?: string
  ): Promise<{ messageId: string }>;

  // কাস্টমারের Facebook প্রোফাইল নাম আনা (PSID থেকে, প্রথমবার কথোপকথন শুরু হলে)
  getUserProfile(pageAccessToken: string, psid: string): Promise<{ name: string | null }>;

  // কমেন্ট অটোমেশন (M3) — পোস্টের কমেন্টে রিপ্লাই, প্রয়োজনে লুকানো/ডিলিট
  replyToComment(pageAccessToken: string, commentId: string, text: string): Promise<{ commentId: string }>;
  hideComment(pageAccessToken: string, commentId: string, hidden: boolean): Promise<void>;
  deleteComment(pageAccessToken: string, commentId: string): Promise<void>;

  // পোস্ট শিডিউলার (M4) — পেজে টেক্সট/ছবি পোস্ট পাবলিশ করা
  publishPost(pageAccessToken: string, pageId: string, message: string, imageUrl?: string): Promise<{ postId: string }>;
}
