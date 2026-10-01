import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import { tryCommentAiReply } from "../lib/comment-ai-reply";
import { resolveSpintax } from "@whatsapp-saas/core/templates/spintax";
import { normalizeBangladeshiPhone } from "@whatsapp-saas/core/utils/phone";
import type { MessengerCommentWebhookJobData, MessengerCommentReplyJobData } from "@whatsapp-saas/core/messenger/types";
import { MESSENGER_JOBS_QUEUE_NAME } from "../queues/messenger-jobs-queue";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
let messengerJobsQueue: Queue | null = null;
function getMessengerJobsQueue() {
  if (!messengerJobsQueue) messengerJobsQueue = new Queue(MESSENGER_JOBS_QUEUE_NAME, { connection });
  return messengerJobsQueue;
}

// মুক্ত-টেক্সটের মধ্যে বাংলাদেশি মোবাইল নাম্বারের মতো একটা অংশ খোঁজে — পাওয়া গেলে
// normalizeBangladeshiPhone() দিয়ে ভ্যালিডেট/নরমালাইজ করে, নাহলে null (ফলস-পজিটিভ এড়াতে)
function extractLeadPhone(text: string): string | null {
  const match = text.match(/\+?(?:880|0)?1[3-9]\d{8}/);
  if (!match) return null;
  return normalizeBangladeshiPhone(match[0]);
}

// নতুন পোস্ট-কমেন্ট (webhook এর "feed" field, item=comment verb=add) — প্রতিটা কমেন্ট সবসময়
// messenger_comments এ লগ হয় (bot_enabled যাই হোক, WhatsApp এর bot_enabled ফিক্সের ঠিক একই
// নীতি: সেভ করা আর রিপ্লাই করা আলাদা জিনিস), ফোন নাম্বার থাকলে লিড হিসেবে ফ্ল্যাগ হয়। বট চালু
// থাকলে active rule (keyword/all) ম্যাচ করে, cooldown পেরোলে রিপ্লাই job বসে।
export async function processMessengerCommentEvent(data: MessengerCommentWebhookJobData) {
  const supabase = getSupabase();

  const { data: page, error: pageError } = await supabase
    .from("messenger_pages")
    .select("id, workspace_id, bot_enabled")
    .eq("page_id", data.pageId)
    .maybeSingle();

  if (pageError) {
    console.error(`[messenger-comment] messenger_pages lookup failed page=${data.pageId}: ${pageError.message}`);
    throw new Error(`messenger_pages lookup failed: ${pageError.message}`);
  }
  if (!page) {
    console.log(`[messenger-comment] no connected page for page_id=${data.pageId}, skipping`);
    return;
  }

  const leadPhone = extractLeadPhone(data.commentText);

  const { data: inserted, error: insertError } = await supabase
    .from("messenger_comments")
    .insert({
      messenger_page_id: page.id,
      workspace_id: page.workspace_id,
      comment_id: data.commentId,
      post_id: data.postId,
      from_psid: data.fromPsid,
      from_name: data.fromName,
      comment_text: data.commentText,
      is_lead: Boolean(leadPhone),
      lead_phone: leadPhone,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(`[messenger-comment] duplicate comment ignored page=${page.id} commentId=${data.commentId}`);
      return;
    }
    console.error(`[messenger-comment] messenger_comments insert failed page=${page.id}: ${insertError.message}`);
    throw new Error(`messenger_comments insert failed: ${insertError.message}`);
  }

  console.log(`[messenger-comment] saved comment page=${page.id} commentId=${data.commentId} lead=${Boolean(leadPhone)}`);

  if (leadPhone) {
    await createNotification(
      page.workspace_id,
      "messenger_comment_lead",
      "কমেন্টে নতুন লিড",
      "messenger",
      "একজন কাস্টমার পোস্টের কমেন্টে ফোন নাম্বার দিয়েছেন — Messenger কমেন্ট লগে দেখুন।"
    );
  }

  if (!page.bot_enabled) {
    console.log(`[messenger-comment] bot is turned off for page=${page.id}, skipping rule matching`);
    return;
  }

  if (!data.commentText.trim()) return; // খালি/শুধু-ছবি কমেন্ট — ম্যাচ করার মতো টেক্সট নেই

  const { data: rules } = await supabase
    .from("messenger_comment_rules")
    .select("id, trigger_type, keyword, action, reply_mode, reply_text, cooldown_seconds")
    .eq("messenger_page_id", page.id)
    .eq("is_active", true);

  const lowerText = data.commentText.toLowerCase();
  const matched = (rules ?? []).find((r) =>
    r.trigger_type === "all" ? true : r.keyword ? lowerText.includes(r.keyword.toLowerCase()) : false
  );
  if (!matched) {
    console.log(`[messenger-comment] no rule matched page=${page.id} commentId=${data.commentId}`);
    return;
  }

  // atomic cooldown — single conditional UPDATE, WhatsApp group keyword rules এর ঠিক একই
  // প্যাটার্ন (দুইটা প্রায়-একসাথে আসা কমেন্ট একই রুলে ম্যাচ করলেও একটাই রিপ্লাই যাবে)
  const cooldownCutoff = new Date(Date.now() - matched.cooldown_seconds * 1000).toISOString();
  const { data: won, error: cooldownError } = await supabase
    .from("messenger_comment_rules")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", matched.id)
    .or(`last_triggered_at.is.null,last_triggered_at.lt.${cooldownCutoff}`)
    .select("id")
    .maybeSingle();

  // cooldownError থাকলেও won স্বাভাবিকভাবেই null/undefined হবে, নিচের !won শাখাতেই পড়বে —
  // কিন্তু "কুলডাউন সক্রিয়" (স্বাভাবিক, no-op) আর "আপডেট আসলে ব্যর্থ হয়েছে" (infra সমস্যা) এই
  // দুটো কেস লগে আলাদা দেখা দরকার, নাহলে চুপচাপ একটা real error "cooldown" হিসেবে চাপা পড়ে যাবে
  if (cooldownError) {
    console.error(`[messenger-comment] cooldown UPDATE ব্যর্থ rule=${matched.id} page=${page.id}: ${cooldownError.message}`);
  }

  if (!won) {
    console.log(`[messenger-comment] rule cooldown active, skipping rule=${matched.id} page=${page.id}`);
    return;
  }

  let replyText: string | null = null;
  if (matched.reply_mode === "fixed") {
    // স্প্যাম-ঝুঁকি কমাতে বৈচিত্র্য — একই রুল বারবার ম্যাচ করলেও প্রতিবার হুবহু একই টেক্সট যাবে না
    replyText = resolveSpintax(matched.reply_text ?? "");
  } else {
    const result = await tryCommentAiReply(supabase, page.workspace_id, data.commentText);
    if (result.kind === "answer") replyText = result.text;
  }

  if (!replyText?.trim()) {
    console.log(`[messenger-comment] no reply text produced (AI skipped or empty), rule=${matched.id}`);
    return;
  }

  if (matched.action === "private_reply" && !data.fromPsid) {
    console.log(`[messenger-comment] private_reply rule matched but no psid available, rule=${matched.id} commentId=${data.commentId}`);
    return;
  }

  if (inserted?.id) {
    const { error: updateError } = await supabase.from("messenger_comments").update({ matched_rule_id: matched.id }).eq("id", inserted.id);
    if (updateError) console.error(`[messenger-comment] matched_rule_id আপডেট ব্যর্থ comment=${inserted.id}: ${updateError.message}`);
  }

  const replyJobData: MessengerCommentReplyJobData = {
    commentId: data.commentId,
    messengerPageId: page.id,
    postId: data.postId,
    fromPsid: data.fromPsid,
    action: matched.action,
    replyText,
  };
  await getMessengerJobsQueue().add("comment-reply", replyJobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  console.log(`[messenger-comment] reply job queued action=${matched.action} commentId=${data.commentId}`);
}
