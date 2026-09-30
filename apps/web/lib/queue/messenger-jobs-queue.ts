import { Queue } from "bullmq";

// apps/worker/src/queues/messenger-jobs-queue.ts তে একই নাম ব্যবহার হয়। এজেন্টের রিপ্লাই
// এখান দিয়ে যায় — WhatsApp এর chatbot-autoreply queue এর সাথে না মিশিয়ে সম্পূর্ণ আলাদা,
// যাতে worker এর Messenger dispatcher কখনো ভুলে WhatsApp job না পায় (বা উল্টোটা)
export const MESSENGER_JOBS_QUEUE_NAME = "messenger-jobs";

let queue: Queue | null = null;

export function getMessengerJobsQueue() {
  if (!queue) {
    queue = new Queue(MESSENGER_JOBS_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
