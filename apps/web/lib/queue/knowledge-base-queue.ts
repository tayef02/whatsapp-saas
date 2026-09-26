import { Queue } from "bullmq";
import { KNOWLEDGE_BASE_QUEUE_NAME } from "@whatsapp-saas/core/chatbot/constants";

export { KNOWLEDGE_BASE_QUEUE_NAME };

let queue: Queue | null = null;

export function getKnowledgeBaseQueue() {
  if (!queue) {
    queue = new Queue(KNOWLEDGE_BASE_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
