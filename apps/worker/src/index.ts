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
import { Worker } from "bullmq";
import { WEBHOOK_QUEUE_NAME } from "./queues/webhook-queue";
import { processWebhookEvent } from "./processors/process-webhook";
import { CONTACT_IMPORT_QUEUE_NAME } from "./queues/contact-import-queue";
import { processContactImport } from "./processors/process-contact-import";

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

console.log("worker চালু হয়েছে, webhook আর contact-import queue শুনছে...");

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
