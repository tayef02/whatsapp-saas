// ইমেইলের সীমা ও warm-up নিয়ম। ফেজ ১ এ provider সীমা শুধু টেস্ট/সিস্টেম ইমেইলে প্রযোজ্য; ক্যাম্পেইন
// scheduler (ফেজ ৩) এই একই ধ্রুবক ব্যবহার করবে। (বিটার workspace সীমা — মাসে ৫০০, দিনে ২৫ — ফেজ ৩ এর
// migration এ plans/workspaces এর কলাম ডিফল্ট হিসেবে বসবে; docs/email-plan.md দেখুন।)

export const DEFAULT_PROVIDER_DAILY_LIMIT = 100;
export const DEFAULT_PROVIDER_MONTHLY_LIMIT = 3000;

// প্রতি workspace এ দিনে (rolling ২৪ ঘণ্টা) সর্বোচ্চ কয়টা টেস্ট ইমেইল / সিস্টেম ইমেইল (Reply-To কনফার্মেশন)
export const TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE = 5;
export const SYSTEM_EMAIL_DAILY_LIMIT_PER_WORKSPACE = 5;

// Reply-To কনফার্মেশন মেইল আবার পাঠানোর ন্যূনতম বিরতি
export const REPLY_TO_CONFIRMATION_COOLDOWN_SECONDS = 60;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// provider এর মোট সীমা env থেকে (ফ্রি প্ল্যান: ১০০/দিন, ৩০০০/মাস)
export function readProviderLimits(env: Record<string, string | undefined> = process.env): { daily: number; monthly: number } {
  return {
    daily: readPositiveInt(env.EMAIL_PROVIDER_DAILY_LIMIT, DEFAULT_PROVIDER_DAILY_LIMIT),
    monthly: readPositiveInt(env.EMAIL_PROVIDER_MONTHLY_LIMIT, DEFAULT_PROVIDER_MONTHLY_LIMIT),
  };
}

// ডোমেইন warm-up: verified_at থেকে কত দিন হলো (১ থেকে শুরু) তার ভিত্তিতে দৈনিক সর্বোচ্চ সংখ্যা।
// নতুন ডোমেইন হঠাৎ বেশি পাঠালে স্প্যাম ধরা পড়ে। ধাপগুলো প্রস্তাবিত — বদলাতে শুধু এই তালিকা।
const WARMUP_STEPS: Array<{ untilDay: number; dailyLimit: number }> = [
  { untilDay: 3, dailyLimit: 50 },
  { untilDay: 7, dailyLimit: 100 },
  { untilDay: 14, dailyLimit: 500 },
  { untilDay: 30, dailyLimit: 2000 },
];
const POST_WARMUP_DAILY_LIMIT = 10000;

export function getWarmupDailyLimit(verifiedAt: Date | string | null, now: Date = new Date()): number {
  if (!verifiedAt) return 0; // যাচাই হয়নি — কিছুই পাঠানো যাবে না
  const dayNumber = Math.floor((now.getTime() - new Date(verifiedAt).getTime()) / 86_400_000) + 1;
  for (const step of WARMUP_STEPS) {
    if (dayNumber <= step.untilDay) return step.dailyLimit;
  }
  return POST_WARMUP_DAILY_LIMIT;
}
