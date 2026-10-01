import { Queue } from "bullmq";
import { MESSENGER_KNOWLEDGE_BASE_QUEUE_NAME } from "@whatsapp-saas/core/messenger/ai-chatbot";

export { MESSENGER_KNOWLEDGE_BASE_QUEUE_NAME };

let queue: Queue | null = null;

export function getMessengerKnowledgeBaseQueue() {
  if (!queue) {
    queue = new Queue(MESSENGER_KNOWLEDGE_BASE_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    });
  }
  return queue;
}
