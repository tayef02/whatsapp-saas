"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMessengerJobsQueue } from "@/lib/queue/messenger-jobs-queue";
import type { MessengerCommentReplyJobData } from "@whatsapp-saas/core/messenger/types";

const PRIVATE_REPLY_WINDOW_DAYS = 7;

// "এখন পাঠান" — rate-limit/অন্য কারণে স্কিপ হওয়া একটা কমেন্টের জন্য ম্যানুয়ালি রিপ্লাই পাঠানো।
// ইচ্ছাকৃতভাবে automated flow (process-messenger-comment.ts) এর hourly/per-customer soft cap
// গুলো আবার চেক করে না — একজন মানুষ সচেতনভাবে এই নির্দিষ্ট কমেন্টটা পাঠাতে চাইছেন। কিন্তু
// Meta-এনফোর্সড শক্ত নিয়ম দুটো এখনো মানা হয়: প্রাইভেট রিপ্লাইয়ের ৭ দিনের উইন্ডো, আর কমেন্ট
// এখনো আছে কিনা (এই চেক process-messenger-comment-reply.ts এর মধ্যেই হয়, job পাঠানোর পর)।
export async function sendSkippedCommentNow(skipId: string, action: "public_reply" | "private_reply", replyText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  if (!replyText.trim()) return { error: "রিপ্লাই টেক্সট দিন" };

  // RLS-স্কোপড সিলেক্ট — এই skip row কলারের workspace এর না হলে এখানেই থেমে যাবে
  const { data: skip } = await supabase
    .from("messenger_comment_skips")
    .select("id, messenger_page_id, comment_id, post_id, from_psid, created_at")
    .eq("id", skipId)
    .maybeSingle();
  if (!skip) return { error: "কমেন্ট পাওয়া যায়নি" };

  if (action === "private_reply") {
    if (!skip.from_psid) return { error: "এই কাস্টমারের psid নেই, প্রাইভেট রিপ্লাই পাঠানো যাবে না — পাবলিক রিপ্লাই ব্যবহার করুন" };

    const ageMs = Date.now() - new Date(skip.created_at).getTime();
    if (ageMs > PRIVATE_REPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      return { error: "৭ দিনের মেয়াদ শেষ — Meta এর নিয়মে এখন আর প্রাইভেট রিপ্লাই পাঠানো যাবে না। পাবলিক রিপ্লাই ব্যবহার করুন।" };
    }
  }

  const jobData: MessengerCommentReplyJobData = {
    commentId: skip.comment_id,
    messengerPageId: skip.messenger_page_id,
    postId: skip.post_id,
    fromPsid: skip.from_psid,
    action,
    replyText: replyText.trim(),
    queuedAt: new Date().toISOString(),
    skipId: skip.id,
  };

  // জবের jobId স্কিপ-আইডি ভিত্তিক — একই skip row তে ডাবল-ক্লিকে দুটো ডুপ্লিকেট জব বসবে না
  // (BullMQ jobId এ কোলন থাকতে পারবে না, uuid তে কোলন থাকে না তাই নিরাপদ)
  try {
    await getMessengerJobsQueue().add("comment-reply", jobData, {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      jobId: `messenger_comment_manual_${skip.id}`,
    });
  } catch (err) {
    console.error(`[sendSkippedCommentNow] queue.add ব্যর্থ skipId=${skip.id}:`, err instanceof Error ? err.message : err);
    return { error: "পাঠানোর জন্য queue তে বসানো যায়নি, একটু পর আবার চেষ্টা করুন" };
  }

  // "কে কখন সামলেছে" এখনই সেট হয় (পর্যালোচনার কাজটা এই মুহূর্তেই হয়েছে) — status অবশ্য
  // "sent_manually" হবে শুধু পাঠানো সফল হলে (worker process-messenger-comment-reply.ts করে)
  const { error: reviewedError } = await supabase
    .from("messenger_comment_skips")
    .update({ reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", skip.id);
  if (reviewedError) console.error(`[sendSkippedCommentNow] reviewed_by আপডেট ব্যর্থ (non-critical) skipId=${skip.id}: ${reviewedError.message}`);

  revalidatePath("/dashboard/messenger/comments/skipped");
  return { error: null };
}

export async function dismissSkippedComment(skipId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const { error } = await supabase
    .from("messenger_comment_skips")
    .update({ status: "dismissed", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", skipId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/comments/skipped");
  return { error: null };
}
