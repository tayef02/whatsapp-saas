import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMessengerWebhookQueue } from "@/lib/queue/messenger-webhook-queue";
import type { MessengerWebhookJobData, MessengerCommentWebhookJobData } from "@whatsapp-saas/core/messenger/types";

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

// Phase M3 — "feed" field এর নিচে comment/post/like ইত্যাদি বিভিন্ন ধরনের item আসতে পারে,
// আমরা শুধু নতুন কমেন্ট (item="comment", verb="add") নিয়ে কাজ করি — এডিট/রিমুভ/রিঅ্যাকশন
// এই ফেজে হ্যান্ডল হয় না
type ChangeEvent = {
  field?: string;
  value?: {
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    message?: string;
    from?: { id?: string; name?: string };
  };
};

// এখানে কোনো DB কাজ হয় না — শুধু signature যাচাই আর queue তে push করে দ্রুত 200 দেওয়া হয়,
// আসল প্রসেসিং apps/worker করে (WhatsApp webhook route এর ঠিক একই নিয়ম)।
//
// ডায়াগনস্টিক লগ: কমেন্ট ইভেন্ট না আসার সমস্যা ডিবাগ করতে প্রতিটা POST এ signature ঠিক/ভুল,
// payload এর object/entry সংখ্যা, প্রতিটা entry এর page_id ও messaging/changes আছে কিনা, আর
// কোনো ইভেন্ট বাদ পড়লে কারণ লগ হয় — কখনো মেসেজ/কমেন্টের লেখা, নাম, token/secret ছাপা হয় না।
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
  const signatureValid = isValidSignature(rawBody, signature, appSecret);

  console.log(`[messenger webhook] POST এসেছে — signature ${signatureValid ? "ঠিক" : "ভুল"}, body size=${rawBody.length} bytes`);

  if (!signatureValid) {
    console.warn("[messenger webhook] signature যাচাই ব্যর্থ, রিকোয়েস্ট বাতিল");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { object?: string; entry?: Array<{ id?: string; messaging?: MessagingEvent[]; changes?: ChangeEvent[] }> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[messenger webhook] body valid JSON না, বাতিল");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  console.log(`[messenger webhook] object="${body.object}", entry সংখ্যা=${body.entry?.length ?? 0}`);

  if (body.object !== "page") {
    console.log(`[messenger webhook] object="${body.object}" — "page" না, পুরো payload উপেক্ষা করা হলো`);
    return NextResponse.json({ status: "ignored" });
  }

  const queue = getMessengerWebhookQueue();
  let queuedMessageCount = 0;
  let queuedCommentCount = 0;

  try {
    // একটা POST এ একাধিক entry/messaging event ব্যাচ হয়ে আসতে পারে — প্রতিটাকে আলাদা job
    // হিসেবে বসানো হচ্ছে, যাতে প্রতিটার নিজস্ব mid-ভিত্তিক jobId (dedup) থাকে
    for (const entry of body.entry ?? []) {
      const pageId = entry.id;
      const messagingCount = entry.messaging?.length ?? 0;
      const changesCount = entry.changes?.length ?? 0;
      console.log(`[messenger webhook] entry — page_id=${pageId ?? "(নেই)"}, messaging=${messagingCount}, changes=${changesCount}`);

      if (!pageId) {
        console.warn("[messenger webhook] entry.id (page_id) নেই, এই entry বাদ দেওয়া হলো");
        continue;
      }

      for (const event of entry.messaging ?? []) {
        const senderPsid = event.sender?.id;
        if (!senderPsid) {
          console.warn(`[messenger webhook] messaging event এ sender.id নেই, বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }
        if (event.message?.is_echo) {
          console.log(`[messenger webhook] echo (নিজের পাঠানো) মেসেজ, বাদ দেওয়া হলো page_id=${pageId}`);
          continue; // নিজের পাঠানো মেসেজের echo, স্কিপ
        }

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

        // BullMQ কাস্টম jobId এ কোলন থাকলে ("messenger:${mid}" এর মতো) "Custom Id cannot
        // contain :" থ্রো করে — jobId.split(':').length ঠিক ৩ না হলে এই থ্রো হয় (bullmq
        // job.js এর addJob)। তাই কোলনের বদলে আন্ডারস্কোর — dedup এর যুক্তি (mid থাকলেই
        // jobId সেট, নাহলে auto-generated) অপরিবর্তিত।
        const jobId = event.message?.mid ? `messenger_${pageId}_${event.message.mid}` : undefined;

        await queue.add("event", jobData, {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
          ...(jobId ? { jobId } : {}),
        });
        queuedMessageCount++;
      }

      // Phase M3 — একই "messenger-webhook-events" queue তে আলাদা job name ("comment") দিয়ে
      // যায়, messengerWebhookWorker এটা দেখে DM ("event") আর comment আলাদা প্রসেসরে পাঠায়
      for (const change of entry.changes ?? []) {
        if (change.field !== "feed") {
          console.log(`[messenger webhook] changes field="${change.field}" — "feed" না, বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }
        const value = change.value;
        if (!value) {
          console.warn(`[messenger webhook] feed change এ value নেই, বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }
        if (value.item !== "comment") {
          console.log(`[messenger webhook] feed item="${value.item}" — "comment" না, বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }
        if (value.verb !== "add") {
          console.log(`[messenger webhook] comment verb="${value.verb}" — "add" না (এডিট/রিমুভ/রিঅ্যাকশন হতে পারে), বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }
        if (!value.comment_id) {
          console.warn(`[messenger webhook] comment এ comment_id নেই, বাদ দেওয়া হলো page_id=${pageId}`);
          continue;
        }

        const commentJobData: MessengerCommentWebhookJobData = {
          pageId,
          commentId: value.comment_id,
          postId: value.post_id ?? null,
          fromPsid: value.from?.id ?? null,
          fromName: value.from?.name ?? null,
          commentText: value.message ?? "",
        };

        const commentJobId = `messenger_comment_${pageId}_${value.comment_id}`;

        await queue.add("comment", commentJobData, {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
          jobId: commentJobId,
        });
        queuedCommentCount++;
      }
    }
  } catch (err) {
    // queue তে বসাতেই ব্যর্থ হলে (Redis ডাউন, বা jobId/payload সংক্রান্ত কোনো বাগ) এই ইভেন্ট
    // চিরতরে হারিয়ে যাবে যদি আমরা এখানে চুপচাপ 200 দিয়ে দিই — Meta 200 না পেলে পরে আবার এই
    // একই POST পাঠায় (retry), তাই এখানে 500 দেওয়াই নিরাপদ, 200 না
    console.error("[messenger webhook] queue.add ব্যর্থ:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "queue unavailable" }, { status: 500 });
  }

  console.log(`[messenger webhook] সম্পন্ন — DM job=${queuedMessageCount}, কমেন্ট job=${queuedCommentCount}`);

  return NextResponse.json({ status: "ok" });
}
