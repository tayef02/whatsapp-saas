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

  await getWebhookQueue().add("event", body, {
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });

  return NextResponse.json({ status: "ok" });
}
