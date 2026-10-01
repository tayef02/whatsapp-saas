// Messenger চ্যানেলের জন্য আলাদা ইন্টারফেস — WhatsAppProvider এর সাথে মেলে না (types.ts এ
// গ্রুপ/পোল/admin-mode এর মতো মেথড আছে যেগুলোর Messenger এ কোনো সমতুল্য নেই), তাই
// implement করার দরকার নেই।
//
// Phase M1: পেজ কানেক্ট (OAuth) + ইনবক্স (টেক্সট পাঠানো, প্রোফাইল নাম আনা) বাস্তবায়িত।
// Phase M2: sendMessage এ tag (HUMAN_AGENT) সাপোর্ট + typing indicator যোগ হয়েছে।
// Phase M3: কমেন্ট রিপ্লাই + Private Reply যোগ হয়েছে। পোস্ট-তৈরির মেথড এখনো নেই (M4 তে আসবে)।

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

  // subscribePageWebhook() কল সফল হওয়া মানেই না যে Meta আসলে প্রতিটা ফিল্ড গ্রহণ করেছে
  // (permission/App Review সীমাবদ্ধতায় কোনো field silently বাদ পড়তে পারে) — এটা Meta কে সরাসরি
  // GET করে আসল অবস্থা ফেরত দেয়, তাই দেখা যায় "feed" সত্যিই আছে কিনা (M3 ফলো-আপ)
  getSubscribedFields(pageId: string, pageAccessToken: string): Promise<string[]>;

  // ইনবক্স — "RESPONSE" ২৪ ঘণ্টা উইন্ডোর ভেতরে (কোনো tag লাগে না)। "MESSAGE_TAG" + tag
  // "HUMAN_AGENT" উইন্ডোর বাইরে কিন্তু কাস্টমারের সর্বশেষ মেসেজের ৭ দিনের মধ্যে (শুধু ইনবক্সের
  // ম্যানুয়াল এজেন্ট রিপ্লাইয়ে ব্যবহার হয়, AI বট/অর্ডার-নোটিফিকেশনে না — প্রোমোশনাল কনটেন্ট
  // কখনোই tag দিয়ে পাঠানো যায় না, Meta নিজেই রিজেক্ট করবে)। App Review approve না হলে Meta
  // একটা permission/tag-সংক্রান্ত এরর দেয় (process-messenger-reply.ts দেখুন)।
  sendMessage(
    pageAccessToken: string,
    psid: string,
    text: string,
    messagingType: "RESPONSE" | "MESSAGE_TAG",
    tag?: "HUMAN_AGENT"
  ): Promise<{ messageId: string }>;

  // রিপ্লাইয়ের ঠিক আগে "টাইপ করছে..." দেখানো — মানুষ-এজেন্টের মতো অনুভূতি দিতে (M2)।
  // কসমেটিক, ব্যর্থ হলেও মূল sendMessage আটকানো উচিত না — তাই এই মেথড কখনো throw করে না
  sendTypingOn(pageAccessToken: string, psid: string): Promise<void>;

  // কাস্টমারের Facebook প্রোফাইল নাম আনা (PSID থেকে) — ব্যর্থ হলে null (M1)
  getUserProfile(pageAccessToken: string, psid: string): Promise<{ name: string | null }>;

  // পোস্টের কমেন্টের নিচে পাবলিক রিপ্লাই (M3)
  replyToComment(pageAccessToken: string, commentId: string, text: string): Promise<{ commentId: string }>;

  // Messenger Private Reply — কমেন্টের মাধ্যমে প্রথমবার ইনবক্সে মেসেজ পাঠানো (কাস্টমার কখনো
  // DM করেনি, শুধু কমেন্ট করেছে — তাই সাধারণ sendMessage()/RESPONSE টাইপ কাজ করবে না, Graph
  // API এর recipient এ psid এর বদলে comment_id পাঠাতে হয়)। Meta নিয়ম: প্রতি কমেন্টে একবারই
  // পাঠানো যায় — এটা এই মেথড নিজে এনফোর্স করে না, caller এর (messenger_comments এর
  // comment_id dedup) দায়িত্ব (M3)
  sendPrivateReply(pageAccessToken: string, commentId: string, text: string): Promise<{ messageId: string }>;
}
