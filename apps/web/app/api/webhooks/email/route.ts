import { NextRequest, NextResponse } from "next/server";
import { getEmailProvider } from "@whatsapp-saas/core/providers/email";
import { getEmailWebhookQueue } from "@/lib/queue/email-queues";

// ইমেইল provider (Resend) এর delivery/bounce/complaint ইভেন্ট। এখানে কোনো DB কাজ হয় না — শুধু
// signature যাচাই (raw body দিয়ে), queue তে push, আর সাথে সাথে 200। আসল প্রসেসিং worker করে।
//
// কোড:
//   401 — signature ভুল/অনুপস্থিত/মেয়াদোত্তীর্ণ (provider আবার পাঠাবে না, ভুল রিকোয়েস্ট)
//   500 — signing secret সেট নেই বা queue ডাউন (provider আবার চেষ্টা করবে, ইভেন্ট হারায় না)
//   200 — queue তে বসেছে
//
// লগে কখনো body, প্রাপকের ঠিকানা, signature বা secret ছাপা হয় না।
export async function POST(request: NextRequest) {
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.error("[email webhook] RESEND_WEBHOOK_SECRET সেট করা নেই");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  // signature raw body দিয়ে যাচাই হয় — JSON পার্স করে আবার string করলে মিলবে না
  const rawBody = await request.text();
  const provider = getEmailProvider();
  const valid = provider.verifyWebhook(rawBody, (name) => request.headers.get(name));
  if (!valid) {
    console.warn("[email webhook] signature যাচাই ব্যর্থ, রিকোয়েস্ট বাতিল");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const svixId = request.headers.get("svix-id") ?? "";
  // BullMQ jobId তে কোলন চলে না — svix-id কে শুধু নিরাপদ অক্ষরে নামিয়ে আনা (একই ইভেন্ট দুইবার এলে
  // একই jobId, queue এ ডুপ্লিকেট হয় না; DB তেও unique আছে)
  const jobId = `email_event_${svixId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  try {
    await getEmailWebhookQueue().add(
      "event",
      { provider: provider.name, providerEventId: svixId, payload },
      { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000, jobId }
    );
  } catch (err) {
    console.error("[email webhook] queue.add ব্যর্থ:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "queue unavailable" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
