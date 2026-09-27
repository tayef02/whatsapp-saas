import path from "node:path";
import { fileURLToPath } from "node:url";

// process.cwd() কোথা থেকে চালানো হচ্ছে তার ওপর নির্ভর না করে, .env সবসময়
// worker ফোল্ডারের নিজের অবস্থান থেকে খোঁজা হয় (npm workspace script দিয়ে চালালেও যেন কাজ করে)
const workerDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  process.loadEnvFile(path.join(workerDir, ".env"));
} catch {
  // .env না থাকলে (যেমন production এ env vars সরাসরি সেট করা থাকলে) ইগনোর করা নিরাপদ
}

import http from "node:http";
import { Queue, Worker } from "bullmq";
import { WEBHOOK_QUEUE_NAME } from "./queues/webhook-queue";
import { processWebhookEvent } from "./processors/process-webhook";
import { CONTACT_IMPORT_QUEUE_NAME } from "./queues/contact-import-queue";
import { processContactImport } from "./processors/process-contact-import";
import { CAMPAIGN_SCHEDULER_QUEUE_NAME, CAMPAIGN_SEND_QUEUE_NAME } from "./queues/campaign-queues";
import { runCampaignSchedulerTick } from "./processors/campaign-scheduler";
import { processSendCampaignMessage } from "./processors/send-campaign-message";
import { SCHEDULER_TICK_MS } from "@whatsapp-saas/core/campaigns/constants";
import { SUBSCRIPTION_MAINTENANCE_QUEUE_NAME } from "./queues/subscription-maintenance-queue";
import { runSubscriptionMaintenanceTick } from "./processors/subscription-maintenance";
import { AUTOREPLY_QUEUE_NAME } from "./queues/autoreply-queue";
import { processAutoReply } from "./processors/process-autoreply";
import { processGroupReply } from "./processors/process-group-reply";
import { processDeleteGroupMessage } from "./processors/process-group-moderation";
import { KNOWLEDGE_BASE_QUEUE_NAME } from "./queues/knowledge-base-queue";
import { processKnowledgeBaseDocument } from "./processors/process-knowledge-base";

const SUBSCRIPTION_MAINTENANCE_TICK_MS = 24 * 60 * 60 * 1000;

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

// একাধিক worker একসাথে চালানো গেলেও BullMQ নিজে থেকেই এক job একবারই দেয়, ডুপ্লিকেট হয় না
const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    await processWebhookEvent(job.data);
  },
  { connection }
);

webhookWorker.on("failed", (job, err) => {
  console.error(`[webhook-worker] job ${job?.id} ব্যর্থ:`, err.message);
});

// বড় কন্টাক্ট ফাইল ব্যাকগ্রাউন্ডে প্রসেস করার worker
const contactImportWorker = new Worker(
  CONTACT_IMPORT_QUEUE_NAME,
  async (job) => {
    await processContactImport(job.data);
  },
  { connection }
);

contactImportWorker.on("failed", (job, err) => {
  console.error(`[contact-import-worker] job ${job?.id} ব্যর্থ:`, err.message);
});

// ক্যাম্পেইন পাঠানোর আসল job (একটা একটা মেসেজ)
const campaignSendWorker = new Worker(
  CAMPAIGN_SEND_QUEUE_NAME,
  async (job) => {
    await processSendCampaignMessage(job.data);
  },
  { connection }
);

campaignSendWorker.on("failed", (job, err) => {
  console.error(`[campaign-send-worker] job ${job?.id} ব্যর্থ:`, err.message);
});

// প্রতি মিনিটে scheduler tick — repeatable job। একাধিক worker চললেও BullMQ
// নিশ্চিত করে repeatable job একবারই চলবে প্রতি টিক এ।
// (tsx watch mode এ top-level await সাপোর্ট করে না, তাই IIFE দিয়ে)
const schedulerQueue = new Queue(CAMPAIGN_SCHEDULER_QUEUE_NAME, { connection });
schedulerQueue
  .add("tick", {}, { repeat: { every: SCHEDULER_TICK_MS }, removeOnComplete: true })
  .catch((err) => console.error("[campaign-scheduler] repeatable job রেজিস্টার করা যায়নি:", err.message));

const campaignSchedulerWorker = new Worker(
  CAMPAIGN_SCHEDULER_QUEUE_NAME,
  async () => {
    await runCampaignSchedulerTick();
  },
  { connection }
);

campaignSchedulerWorker.on("failed", (job, err) => {
  console.error(`[campaign-scheduler] tick ব্যর্থ:`, err.message);
});

// দিনে একবার: মেয়াদ শেষ হওয়া workspace আর মেয়াদ-শেষের-কাছাকাছি নোটিফিকেশন
const subscriptionQueue = new Queue(SUBSCRIPTION_MAINTENANCE_QUEUE_NAME, { connection });
subscriptionQueue
  .add("tick", {}, { repeat: { every: SUBSCRIPTION_MAINTENANCE_TICK_MS }, removeOnComplete: true })
  .catch((err) => console.error("[subscription-maintenance] repeatable job রেজিস্টার করা যায়নি:", err.message));

const subscriptionWorker = new Worker(
  SUBSCRIPTION_MAINTENANCE_QUEUE_NAME,
  async () => {
    await runSubscriptionMaintenanceTick();
  },
  { connection }
);

subscriptionWorker.on("failed", (job, err) => {
  console.error(`[subscription-maintenance] tick ব্যর্থ:`, err.message);
});

// keyword rule/fallback ম্যাচ হলে auto-reply পাঠানোর job — একই queue তে ১:১ চ্যাটের "reply",
// গ্রুপ কিওয়ার্ডের "group-reply", আর স্প্যাম-ফিল্টারের "delete-group-message" — তিন ধরনের
// job আসে, job.name দিয়ে আলাদা করা হয়
const autoReplyWorker = new Worker(
  AUTOREPLY_QUEUE_NAME,
  async (job) => {
    if (job.name === "group-reply") {
      await processGroupReply(job.data);
    } else if (job.name === "delete-group-message") {
      await processDeleteGroupMessage(job.data);
    } else {
      await processAutoReply(job.data);
    }
  },
  { connection }
);

autoReplyWorker.on("failed", (job, err) => {
  console.error(`[autoreply-worker] job ${job?.id} ব্যর্থ:`, err.message);
});

// knowledge base ফাইল (PDF/XLSX/CSV/TXT) আপলোড হলে extract+chunk+embed করার job
const knowledgeBaseWorker = new Worker(
  KNOWLEDGE_BASE_QUEUE_NAME,
  async (job) => {
    await processKnowledgeBaseDocument(job.data);
  },
  { connection }
);

knowledgeBaseWorker.on("failed", (job, err) => {
  console.error(`[knowledge-base-worker] job ${job?.id} ব্যর্থ:`, err.message);
});

console.log(
  "worker চালু হয়েছে — webhook, contact-import, campaign-scheduler, campaign-send, subscription-maintenance, chatbot-autoreply, knowledge-base-process queue শুনছে..."
);

// /health এন্ডপয়েন্ট — Uptime Kuma দিয়ে মনিটর করার জন্য
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "worker" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3100);
healthServer.listen(healthPort, () => {
  console.log(`worker health check: http://localhost:${healthPort}/health`);
});
