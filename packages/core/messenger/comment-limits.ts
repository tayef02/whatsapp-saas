// Messenger কমেন্ট রিপ্লাইয়ের rate-limit ধ্রুবক — এক জায়গায় রাখা, যাতে পরে টিউন করার সময়
// একাধিক ফাইলে খুঁজে বেড়াতে না হয়। ডিফল্ট মানগুলো রক্ষণশীল (conservative) — বড় পেজে দরকার
// হলে বাড়ানো যায়।

export const MESSENGER_COMMENT_LIMITS = {
  // পাবলিক রিপ্লাই — drip queue (migration 0049) এর উপরে অতিরিক্ত hard cap
  PUBLIC_REPLY_PER_CUSTOMER_POST_PER_HOUR: 3,
  PUBLIC_REPLY_PER_PAGE_PER_HOUR: 100,
  // drip delay এটার বেশি হলে কিউতে না বসিয়েই স্কিপ (reason=cooldown_active) — অনেকক্ষণ পরে
  // একটা "দাম ৫০০ টাকা" রিপ্লাই পাওয়াটা কাস্টমারের কাছে অপ্রাসঙ্গিক/রোবোটিক লাগতে পারে
  PUBLIC_REPLY_MAX_QUEUE_DELAY_MINUTES: 30,

  // প্রাইভেট রিপ্লাই — কখনো delay হয় না, cap ছাড়ালে সরাসরি স্কিপ
  PRIVATE_REPLY_PER_CUSTOMER_POST_TOTAL: 3,
  PRIVATE_REPLY_PER_PAGE_PER_HOUR: 50,

  // worker এর queue তে বসানোর পর send হওয়ার আগে এর বেশি সময় পার হয়ে গেলে (infra backlog,
  // Redis ডাউন ইত্যাদির কারণে) পাঠানো হবে না (reason=queue_expired) — পাবলিক আর প্রাইভেট দুটোতেই
  // একই থ্রেশহোল্ড ব্যবহার হয়, সামঞ্জস্যের জন্য PUBLIC_REPLY_MAX_QUEUE_DELAY_MINUTES এর সমান
  SEND_STALENESS_LIMIT_MINUTES: 30,

  // "স্কিপড কমেন্ট" রিভিউ তালিকায় কতদিন পুরনো pending_review রো pending থাকবে — এর পরে
  // private-reply-intended রো গুলো reason=expired_7d এ মার্ক হয় (Messenger এর ৭ দিনের
  // মেসেজিং উইন্ডোর সাথে সামঞ্জস্যপূর্ণ, App এর বাকি জায়গায় একই ৭ দিন ব্যবহার হয়)
  SKIP_REVIEW_EXPIRY_DAYS: 7,
} as const;
