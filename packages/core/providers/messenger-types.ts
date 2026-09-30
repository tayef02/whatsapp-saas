// Messenger চ্যানেলের জন্য আলাদা ইন্টারফেস — WhatsAppProvider এর সাথে মেলে না (types.ts এ
// গ্রুপ/পোল/admin-mode এর মতো মেথড আছে যেগুলোর Messenger এ কোনো সমতুল্য নেই), তাই
// implement করার দরকার নেই।
//
// Phase M1: পেজ কানেক্ট (OAuth) + ইনবক্স (টেক্সট পাঠানো, প্রোফাইল নাম আনা) বাস্তবায়িত।
// কমেন্ট/পোস্ট মেথড এখনো নেই (M3/M4 এ আসবে)।

export interface MessengerPageInfo {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}

export interface MessengerProvider {
  // ধাপ ১: Facebook এর OAuth ডায়ালগে পাঠানোর URL বানায় (M1)
  getOAuthDialogUrl(redirectUri: string, state: string): string;

  // ধাপ ২: callback এ পাওয়া code কে প্রথমে short-lived, তারপর long-lived user token এ
  // এক্সচেঞ্জ করে (M1)
  exchangeCodeForUserToken(code: string, redirectUri: string): Promise<{ userAccessToken: string }>;
  getLongLivedUserToken(shortLivedToken: string): Promise<{ userAccessToken: string }>;

  // ধাপ ৩: ইউজার যে পেজগুলো ম্যানেজ করে তার তালিকা (প্রতিটার নিজস্ব page access token সহ) (M1)
  listPages(userAccessToken: string): Promise<MessengerPageInfo[]>;

  // পেজ কানেক্ট/ডিসকানেক্ট হলে webhook সাবস্ক্রাইব/আনসাবস্ক্রাইব (M1)
  subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void>;
  unsubscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void>;

  // ইনবক্স (M1: টেক্সট, M2 এ media/tag যোগ হবে) — messagingType "RESPONSE" (২৪ ঘণ্টা
  // উইন্ডোর ভেতরে) M1 এ একমাত্র সাপোর্টেড টাইপ, উইন্ডোর বাইরে পাঠানো UI লেভেলেই আটকানো হয়
  sendMessage(pageAccessToken: string, psid: string, text: string, messagingType: "RESPONSE"): Promise<{ messageId: string }>;

  // কাস্টমারের Facebook প্রোফাইল নাম আনা (PSID থেকে) — ব্যর্থ হলে null (M1)
  getUserProfile(pageAccessToken: string, psid: string): Promise<{ name: string | null }>;
}
