// স্কিপ-কারণ কোড (worker এর writeMessengerCommentSkip() যে ১০টা reason লেখে তার সাথে মেলে) —
// এই পেজ আর স্কিপড-কমেন্ট রিভিউ পেজ দুটোতেই একই লেবেল দেখানোর জন্য শেয়ার্ড

export const SKIP_REASON_LABEL: Record<string, string> = {
  cooldown_active: "Cooldown-এ আটকেছে",
  limit_per_customer: "কাস্টমার সীমা ছাড়িয়েছে",
  limit_per_page: "পেজের ঘণ্টার সীমা ছাড়িয়েছে",
  rule_not_matched: "কোনো রুল মেলেনি",
  private_limit: "প্রাইভেট রিপ্লাই সীমা ছাড়িয়েছে",
  comment_deleted: "কমেন্ট ডিলিট হয়ে গেছে",
  expired_7d: "৭ দিনের মেয়াদ শেষ",
  bot_disabled: "বট বন্ধ ছিল",
  reply_failed: "পাঠানো ব্যর্থ হয়েছে",
  queue_expired: "কিউতে অনেক দেরি হয়ে গেছে",
};

export const SKIP_STATUS_LABEL: Record<string, string> = {
  pending_review: "পর্যালোচনার অপেক্ষায়",
  sent_manually: "ম্যানুয়ালি পাঠানো হয়েছে",
  dismissed: "বাদ দেওয়া হয়েছে",
};
