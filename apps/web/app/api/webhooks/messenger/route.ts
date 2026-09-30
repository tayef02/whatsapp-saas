import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMessengerWebhookQueue } from "@/lib/queue/messenger-webhook-queue";
import type { MessengerWebhookJobData } from "@whatsapp-saas/core/messenger/types";

// Meta একবার এই GET কল করে webhook URL verify করে — hub.verify_token মিলিয়ে hub.challenge
// ফেরত দিতে হয়। এটা কোনো secret না (আমরা নিজেরাই বসানো একটা সেটআপ-টাইম পাসওয়ার্ড), তাই
// সাধারণ string compare যথেষ্ট — নিচের POST এর HMAC signature-ই আসল নিরাপত্তা স্তর।
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "verify_token মেলেনি" }, { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  // দৈর্ঘ্য না মিললে timingSafeEqual নিজেই throw করে — আগে চেক করে নেওয়া হচ্ছে
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: Array<{ type: string; payload?: { url?: string } }>;
    is_echo?: boolean; // পেজ থেকে নিজে পাঠানো মেসেজের echo — স্কিপ করতে হবে
  };
};

// এখানে কোনো DB কাজ হয় না — শুধু signature যাচাই আর queue তে push করে দ্রুত 200 দেওয়া হয়,
// আসল প্রসেসিং apps/worker করে (WhatsApp webhook route এর ঠিক একই নিয়ম)
export async function POST(request: NextRequest) {
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appSecret) {
    // এটা কনফিগারেশন ভুল (env var সেট নেই), Meta কে জানিয়ে দেওয়া ভালো যাতে retry না করে
    // অপেক্ষা করতে থাকে — কিন্তু কোনো ক্ষেত্রেই secret/token নিজেই লগ হচ্ছে না
    console.error("[messenger webhook] MESSENGER_APP_SECRET সেট করা নেই");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!isValidSignature(rawBody, signature, appSecret)) {
    console.warn("[messenger webhook] signature যাচাই ব্যর্থ, রিকোয়েস্ট বাতিল");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { object?: string; entry?: Array<{ id?: string; messaging?: MessagingEvent[] }> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.object !== "page") {
    return NextResponse.json({ status: "ignored" });
  }

  const queue = getMessengerWebhookQueue();

  // একটা POST এ একাধিক entry/messaging event ব্যাচ হয়ে আসতে পারে — প্রতিটাকে আলাদা job
  // হিসেবে বসানো হচ্ছে, যাতে প্রতিটার নিজস্ব mid-ভিত্তিক jobId (dedup) থাকে
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;

    for (const event of entry.messaging ?? []) {
      const senderPsid = event.sender?.id;
      if (!senderPsid || event.message?.is_echo) continue; // নিজের পাঠানো মেসেজের echo, স্কিপ

      const jobData: MessengerWebhookJobData = {
        pageId,
        senderPsid,
        timestamp: event.timestamp ?? Date.now(),
        message: event.message?.mid
          ? {
              mid: event.message.mid,
              text: event.message.text,
              attachments: event.message.attachments,
            }
          : undefined,
      };

      const jobId = event.message?.mid ? `messenger:${event.message.mid}` : undefined;

      await queue.add("event", jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
        ...(jobId ? { jobId } : {}),
      });
    }
  }

  return NextResponse.json({ status: "ok" });
}
