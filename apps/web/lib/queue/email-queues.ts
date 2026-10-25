import { Queue } from "bullmq";

// apps/worker/src/queues/email-queues.ts তে একই নাম ব্যবহার হয়। ইমেইলের queue WhatsApp/Messenger
// থেকে সম্পূর্ণ আলাদা — চ্যানেলের ইভেন্ট কখনো মিশবে না
export const EMAIL_WEBHOOK_QUEUE_NAME = "email-webhook-events";
export const EMAIL_JOBS_QUEUE_NAME = "email-jobs";

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" } });
    queues.set(name, queue);
  }
  return queue;
}

export function getEmailWebhookQueue() {
  return getQueue(EMAIL_WEBHOOK_QUEUE_NAME);
}

// টেস্ট ইমেইল, Reply-To কনফার্মেশন — web থেকে সরাসরি পাঠানো হয় না, worker পাঠায়
export function getEmailJobsQueue() {
  return getQueue(EMAIL_JOBS_QUEUE_NAME);
}
