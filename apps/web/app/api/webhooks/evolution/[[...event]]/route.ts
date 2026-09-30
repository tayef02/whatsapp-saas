import { NextRequest, NextResponse } from "next/server";
import { getWebhookQueue } from "@/lib/queue/webhook-queue";

// Evolution API ইভেন্ট নাম অনুযায়ী URL এর শেষে subpath যোগ করে পাঠায়
// (যেমন /api/webhooks/evolution/qrcode-updated, /connection-update), তাই
// [[...event]] দিয়ে যেকোনো subpath এই একই হ্যান্ডলারে আসবে। ইভেন্টের নাম
// body.event ফিল্ড থেকেই পড়া হয়, URL থেকে না — তাই subpath নিয়ে চিন্তা করতে হয় না।
//
// এখানে কোনো ভারী কাজ হবে না — শুধু queue তে push করে সাথে সাথে 200 দেওয়া হয়,
// আসল প্রসেসিং apps/worker করে (নিয়ম অনুযায়ী: ওয়েবহুক কখনো ব্লক করবে না)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // ডিবাগের জন্য ছোট লগ — Evolution থেকে আদৌ ইভেন্ট আসছে কিনা, কোন instance এর,
  // সেটা নিশ্চিত হওয়ার জন্য (ভারী কিছু না, পুরো body লগ হয় না — media base64 থাকতে পারে)
  console.log(`[webhook route] event=${body?.event} instance=${body?.instance}`);

  // messages.upsert/messages.update এর মতো ইভেন্টে Evolution/Baileys এর নিজস্ব ইউনিক
  // মেসেজ আইডি (data.key.id) থাকে — সেটা দিয়ে jobId বানালে Evolution ভুলবশত একই ওয়েবহুক
  // দুইবার পাঠালেও (নেটওয়ার্ক রিট্রাই ইত্যাদি) BullMQ দ্বিতীয় জব আলাদাভাবে queue করবে না।
  // connection.update/qrcode.updated এর মতো ইভেন্টে কোনো natural message id নেই — সেগুলোতে
  // জোর করে jobId বসালে ভিন্ন-ভিন্ন legitimate ইভেন্ট ভুলে dedup হয়ে হারিয়ে যেত, তাই শুধু
  // messageId পাওয়া গেলেই jobId সেট হচ্ছে, নাহলে BullMQ এর ডিফল্ট auto-generated id থাকবে।
  //
  // এটা শুধু "Evolution একই ইভেন্ট দুইবার পাঠিয়েছে" এই কেস ঠেকায় — BullMQ নিজে থেকে একটা
  // ব্যর্থ জব retry (attempts) করলে সেটা একই job/jobId-ই আবার চালায়, নতুন job না, তাই সেই
  // ক্ষেত্রে dedup নির্ভর করে প্রসেসিং কোডের নিজস্ব idempotency এর উপর (১:১ চ্যাটে ইতিমধ্যে
  // conversation_messages এর unique index দিয়ে এটা সুরক্ষিত — migration 0024 দেখুন)।
  const messageId = body?.data?.key?.id as string | undefined;
  const jobId = messageId ? `${body?.instance}:${body?.event}:${messageId}` : undefined;

  await getWebhookQueue().add("event", body, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
    ...(jobId ? { jobId } : {}),
  });

  return NextResponse.json({ status: "ok" });
}
