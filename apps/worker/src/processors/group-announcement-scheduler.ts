import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { AUTOREPLY_QUEUE_NAME } from "../queues/autoreply-queue";
import type { SendGroupAnnouncementJobData } from "@whatsapp-saas/core/groups/types";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
let sendQueue: Queue | null = null;
function getSendQueue() {
  if (!sendQueue) sendQueue = new Queue(AUTOREPLY_QUEUE_NAME, { connection });
  return sendQueue;
}

// একাধিক গ্রুপে একই অ্যানাউন্সমেন্ট পাঠানোর সময় bulk/একসাথে না পাঠিয়ে ধীরে ধীরে (staggered)
// পাঠানো হয় — প্রতিটা টার্গেটের মধ্যে ১-৩ মিনিট র‍্যান্ডম ডিলে, স্প্যামের মতো আচরণ এড়াতে
const MIN_TARGET_DELAY_MS = 60_000;
const MAX_TARGET_DELAY_MS = 180_000;

function randomTargetDelay() {
  return MIN_TARGET_DELAY_MS + Math.floor(Math.random() * (MAX_TARGET_DELAY_MS - MIN_TARGET_DELAY_MS));
}

// প্রতি মিনিটে চলে (campaign-scheduler এর মতো repeatable tick) — সময় হয়ে যাওয়া
// (scheduled_at <= now, status='pending') announcement খুঁজে, প্রতিটা টার্গেট গ্রুপে
// দৈনিক লিমিট চেক করে, লিমিটের মধ্যে থাকলে staggered delay সহ send job বসায়
export async function runGroupAnnouncementSchedulerTick() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: dueAnnouncements } = await supabase
    .from("group_scheduled_announcements")
    .select("id, workspace_id, message_text, poll_options, poll_multi_select")
    .eq("status", "pending")
    .lte("scheduled_at", now);

  for (const ann of dueAnnouncements ?? []) {
    // atomic claim — একাধিক worker চললেও একবারই প্রসেস হবে
    const { data: claimed } = await supabase
      .from("group_scheduled_announcements")
      .update({ status: "sending" })
      .eq("id", ann.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    const { data: targets } = await supabase
      .from("group_scheduled_announcement_targets")
      .select("id, group_id, groups(whatsapp_number_id, group_jid, max_daily_scheduled_messages)")
      .eq("announcement_id", ann.id)
      .eq("status", "pending");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let cumulativeDelayMs = 0;
    for (const target of targets ?? []) {
      const group = Array.isArray(target.groups) ? target.groups[0] : target.groups;
      if (!group) continue;

      const { count: sentToday } = await supabase
        .from("group_scheduled_announcement_targets")
        .select("id", { count: "exact", head: true })
        .eq("group_id", target.group_id)
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString());

      if ((sentToday ?? 0) >= (group.max_daily_scheduled_messages ?? 3)) {
        await supabase.from("group_scheduled_announcement_targets").update({ status: "skipped_limit" }).eq("id", target.id);
        console.log(`[group-announcement] daily limit reached for group=${group.group_jid}, target=${target.id} skipped`);
        continue;
      }

      const jobData: SendGroupAnnouncementJobData = {
        targetId: target.id,
        whatsappNumberId: group.whatsapp_number_id,
        groupJid: group.group_jid,
        messageText: ann.message_text,
        pollOptions: ann.poll_options,
        pollMultiSelect: ann.poll_multi_select,
      };

      cumulativeDelayMs += randomTargetDelay();
      await getSendQueue().add("send-group-announcement", jobData, {
        delay: cumulativeDelayMs,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      });
    }

    await supabase.from("group_scheduled_announcements").update({ status: "sent" }).eq("id", ann.id);
    console.log(`[group-announcement] announcement=${ann.id} processed, ${targets?.length ?? 0} target(s) queued/skipped`);
  }
}
