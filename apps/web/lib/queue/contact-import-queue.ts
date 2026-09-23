import { Queue } from "bullmq";

// apps/worker/src/queues/contact-import-queue.ts তে একই নাম ব্যবহার হয়
export const CONTACT_IMPORT_QUEUE_NAME = "contact-import";

let queue: Queue | null = null;

export function getContactImportQueue() {
  if (!queue) {
    queue = new Queue(CONTACT_IMPORT_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
