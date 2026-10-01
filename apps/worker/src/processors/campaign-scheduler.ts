import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import { CAMPAIGN_SEND_QUEUE_NAME } from "../queues/campaign-queues";
import { isQuietHoursNow } from "@whatsapp-saas/core/campaigns/quiet-hours";
import {
  DISPATCH_LOOKAHEAD_MS,
  SCHEDULE_BATCH_SIZE,
  MAX_SEND_RETRIES,
  FAILURE_RATE_WINDOW,
  FAILURE_RATE_THRESHOLD,
} from "@whatsapp-saas/core/campaigns/constants";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
let sendQueue: Queue | null = null;
function getSendQueue() {
  if (!sendQueue) sendQueue = new Queue(CAMPAIGN_SEND_QUEUE_NAME, { connection });
  return sendQueue;
}

// প্রতি মিনিটে এই ফাংশন চলে (index.ts এ repeatable job হিসেবে রেজিস্টার করা)।
// রোলিং-হরাইজন ডিজাইন: Redis এ কখনো "পরের কয়েক মিনিট" এর বেশি job জমা হয় না,
// আসল হিসাব (দৈনিক লিমিট, warmup, quiet hours) সবসময় DB থেকে আসে।
export async function runCampaignSchedulerTick() {
  console.log("[campaign-scheduler] tick শুরু", new Date().toISOString());
  const supabase = getSupabase();

  // ০. worker ক্র্যাশে আটকে থাকা মেসেজ পরিষ্কার
  await supabase.rpc("mark_stuck_messages_unknown");

  // ১. যেসব শিডিউল করা ক্যাম্পেইনের সময় হয়ে গেছে, সেগুলো চালু করা
  await supabase
    .from("campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  // ১.৫ যেসব 'sending' ক্যাম্পেইনের আর কোনো pending/scheduled/sending মেসেজ নেই
  // (সব sent/delivered/read/failed/cancelled/unknown এ পৌঁছে গেছে), সেগুলো 'completed' করা —
  // নাহলে এরা চিরকাল 'sending' দেখাবে আর disconnect-pause এর মতো লজিক ভুল করে এদের ধরবে
  await markCompletedCampaigns();

  // ২. Phase A — প্রতিটা অনলাইন নাম্বারের জন্য (সব ক্যাম্পেইন মিলিয়ে) নতুন মেসেজ শিডিউল করা
  const { data: numbers } = await supabase.from("whatsapp_numbers").select("id, workspace_id").eq("status", "online");

  for (const number of numbers ?? []) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("quiet_hours_start_hour, quiet_hours_end_hour")
      .eq("id", number.workspace_id)
      .maybeSingle();

    const quiet = workspace ? isQuietHoursNow(workspace.quiet_hours_start_hour, workspace.quiet_hours_end_hour) : false;

    await supabase.rpc("schedule_number_messages", {
      p_number_id: number.id,
      p_is_quiet_hours: quiet,
      p_batch_size: SCHEDULE_BATCH_SIZE,
    });
  }

  // ৩. Phase B — পরের কয়েক মিনিটের মধ্যে যেগুলো পাঠানোর কথা, সেগুলোই শুধু BullMQ তে দেওয়া
  const lookaheadTime = new Date(Date.now() + DISPATCH_LOOKAHEAD_MS).toISOString();
  const { data: dueMessages } = await supabase
    .from("messages")
    .select("id, scheduled_at")
    .eq("status", "scheduled")
    .is("enqueued_at", null)
    .lte("scheduled_at", lookaheadTime)
    .limit(500);

  for (const msg of dueMessages ?? []) {
    const delay = Math.max(0, new Date(msg.scheduled_at as string).getTime() - Date.now());
    await getSendQueue().add(
      "send",
      { messageId: msg.id },
      { delay, attempts: MAX_SEND_RETRIES + 2, backoff: { type: "exponential", delay: 5000 } }
    );
    await supabase.from("messages").update({ enqueued_at: new Date().toISOString() }).eq("id", msg.id);
  }

  // ৪. উচ্চ failure rate দেখলে অটো-পজ
  await autoPauseHighFailureCampaigns();
}

async function markCompletedCampaigns() {
  const supabase = getSupabase();

  const { data: sendingCampaigns } = await supabase.from("campaigns").select("id").eq("status", "sending");
  if (!sendingCampaigns || sendingCampaigns.length === 0) return;

  const { data: unfinished } = await supabase
    .from("messages")
    .select("campaign_id")
    .in("campaign_id", sendingCampaigns.map((c: { id: string }) => c.id))
    .in("status", ["pending", "scheduled", "sending"]);

  const stillRunning = new Set((unfinished ?? []).map((m: { campaign_id: string }) => m.campaign_id));
  const completedIds = sendingCampaigns.map((c: { id: string }) => c.id).filter((id: string) => !stillRunning.has(id));

  if (completedIds.length > 0) {
    await supabase
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .in("id", completedIds);
  }
}

async function autoPauseHighFailureCampaigns() {
  const supabase = getSupabase();

  const { data: campaigns } = await supabase.from("campaigns").select("id, workspace_id").eq("status", "sending");

  for (const campaign of campaigns ?? []) {
    const { data: recent } = await supabase
      .from("messages")
      .select("status")
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered", "read", "failed"])
      .not("claimed_at", "is", null)
      .order("claimed_at", { ascending: false })
      .limit(FAILURE_RATE_WINDOW);

    if (!recent || recent.length < 10) continue;

    const failedCount = recent.filter((m: { status: string }) => m.status === "failed").length;
    const rate = failedCount / recent.length;

    if (rate > FAILURE_RATE_THRESHOLD) {
      await supabase
        .from("campaigns")
        .update({ status: "paused", paused_reason: "high_failure_rate" })
        .eq("id", campaign.id);

      await createNotification(
        campaign.workspace_id,
        "campaign_auto_paused",
        "ব্যর্থতার হার বেশি হওয়ায় ক্যাম্পেইন থামানো হয়েছে",
        "whatsapp",
        `শেষ ${recent.length}টা মেসেজের মধ্যে ${failedCount}টা ফেল করেছে (${Math.round(rate * 100)}%)। চেক করে আবার চালু করুন।`
      );
    }
  }
}
