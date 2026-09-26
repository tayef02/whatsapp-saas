import { Queue } from "bullmq";

// worker/src/queues/autoreply-queue.ts তে একই নাম আর কানেকশন কনফিগ ব্যবহার হয়
export const AUTOREPLY_QUEUE_NAME = "chatbot-autoreply";

let queue: Queue | null = null;

export function getAutoReplyQueue() {
  if (!queue) {
    queue = new Queue(AUTOREPLY_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
