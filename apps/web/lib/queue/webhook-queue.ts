import { Queue } from "bullmq";

// worker/src/queues/webhook-queue.ts তে একই নাম আর কানেকশন কনফিগ ব্যবহার হয়
export const WEBHOOK_QUEUE_NAME = "evolution-webhook-events";

let queue: Queue | null = null;

export function getWebhookQueue() {
  if (!queue) {
    queue = new Queue(WEBHOOK_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
