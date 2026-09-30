import { Queue } from "bullmq";

// apps/worker/src/queues/messenger-webhook-queue.ts তে একই নাম ব্যবহার হয়। WhatsApp এর
// evolution-webhook-events থেকে ইচ্ছাকৃতভাবে আলাদা queue — দুই চ্যানেলের ইভেন্ট কখনো মিশবে না
export const MESSENGER_WEBHOOK_QUEUE_NAME = "messenger-webhook-events";

let queue: Queue | null = null;

export function getMessengerWebhookQueue() {
  if (!queue) {
    queue = new Queue(MESSENGER_WEBHOOK_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
