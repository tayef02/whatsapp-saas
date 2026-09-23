// প্রতি মিনিটে scheduler tick চলবে
export const SCHEDULER_TICK_MS = 60 * 1000;
// ধাপ B: এর মধ্যে scheduled_at পড়লে এখনই BullMQ তে পাঠিয়ে দেওয়া হবে
export const DISPATCH_LOOKAHEAD_MS = 2 * 60 * 1000;
// একটা tick এ প্রতি নাম্বারে সর্বোচ্চ এতগুলো নতুন মেসেজ schedule হবে
export const SCHEDULE_BATCH_SIZE = 20;
// সাময়িক এরর হলে সর্বোচ্চ এতবার আবার চেষ্টা হবে
export const MAX_SEND_RETRIES = 3;
// এর বেশি সময় 'sending' এ আটকে থাকলে 'unknown' ধরা হবে
export const STUCK_SENDING_MINUTES = 10;
// শেষ এত মেসেজের মধ্যে failure rate এর বেশি হলে ক্যাম্পেইন অটো-পজ হবে
export const FAILURE_RATE_WINDOW = 20;
export const FAILURE_RATE_THRESHOLD = 0.3;
