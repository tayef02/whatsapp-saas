import { Queue } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import { tryCommentAiReply } from "../lib/comment-ai-reply";
import { writeMessengerCommentSkip } from "../lib/messenger-comment-skip";
import { resolveSpintax } from "@whatsapp-saas/core/templates/spintax";
import { normalizeBangladeshiPhone } from "@whatsapp-saas/core/utils/phone";
import { MESSENGER_COMMENT_LIMITS } from "@whatsapp-saas/core/messenger/comment-limits";
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

// post_id/from_psid নালেবল — .eq("col", null) কাজ করে না Supabase এ, .is() লাগে
function matchNullable(query: any, column: string, value: string | null) {
  return value === null ? query.is(column, value) : query.eq(column, value);
}

async function countMatchingComments(
  supabase: SupabaseClient,
  filters: {
    messengerPageId?: string;
    fromPsid?: string | null;
    postId?: string | null;
    matchedRuleId?: string;
    action: "public_reply" | "private_reply";
    sinceMinutesAgo?: number; // না দিলে সারাজীবনের কাউন্ট (lifetime)
  }
): Promise<number> {
  let query = supabase.from("messenger_comments").select("id", { count: "exact", head: true }).eq("action", filters.action);
  if (filters.messengerPageId) query = query.eq("messenger_page_id", filters.messengerPageId);
  if (filters.matchedRuleId) query = query.eq("matched_rule_id", filters.matchedRuleId);
  if (filters.fromPsid !== undefined) query = matchNullable(query, "from_psid", filters.fromPsid);
  if (filters.postId !== undefined) query = matchNullable(query, "post_id", filters.postId);
  if (filters.sinceMinutesAgo) {
    const cutoff = new Date(Date.now() - filters.sinceMinutesAgo * 60 * 1000).toISOString();
    query = query.gte("queued_at", cutoff);
  }

  const { count, error } = await query;
  if (error) {
    // গণনা ব্যর্থ হলে limit-check এর জন্য ০ ধরে নেওয়া (fail-open) — infra সমস্যায় বৈধ রিপ্লাই
    // আটকে যাওয়ার চেয়ে কদাচিৎ limit একটু বেশি হয়ে যাওয়া নিরাপদ, শুধু লগ হচ্ছে
    console.error(`[messenger-comment] rate-limit কাউন্ট ব্যর্থ (fail-open, 0 ধরা হলো): ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

// নতুন পোস্ট-কমেন্ট (webhook এর "feed" field, item=comment verb=add) — প্রতিটা কমেন্ট সবসময়
// messenger_comments এ লগ হয় (bot_enabled যাই হোক, WhatsApp এর bot_enabled ফিক্সের ঠিক একই
// নীতি: সেভ করা আর রিপ্লাই করা আলাদা জিনিস), ফোন নাম্বার থাকলে লিড হিসেবে ফ্ল্যাগ হয়। বট চালু
// থাকলে active rule (keyword/all) ম্যাচ করে, rate-limit এর মধ্যে থাকলে রিপ্লাই job বসে।
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
    console.log(`[messenger-comment] skip reason=unknown_page page_id=${data.pageId} — এই page_id এর কোনো কানেক্টেড পেজ পাওয়া যায়নি`);
    return;
  }

  // Facebook এর নিয়ম: পেজ নিজে যখন কোনো কমেন্টে রিপ্লাই দেয় (আমাদের নিজের public_reply, বা
  // অ্যাডমিন Page Inbox থেকে ম্যানুয়ালি রিপ্লাই), সেটাও webhook এ একটা নতুন "comment"/"add"
  // ইভেন্ট হিসেবেই আসে, from.id = পেজের নিজের page_id। এটা ফিল্টার না করলে "সব কমেন্ট" ট্রিগার
  // রুল নিজের রিপ্লাইকেও ম্যাচ করে বারবার রিপ্লাই দিতে থাকতে পারে — তাই page_id এর সাথে fromPsid
  // মিললেই শুরুতেই স্কিপ (এটা কোনো কাস্টমার ইন্টারঅ্যাকশন না, রিভিউ-তালিকায়ও যাওয়ার দরকার নেই)
  if (data.fromPsid && data.fromPsid === data.pageId) {
    console.log(`[messenger-comment] skip reason=own_page_comment page_id=${data.pageId} commentId=${data.commentId} — পেজ নিজেই এই কমেন্ট করেছে`);
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
      console.log(`[messenger-comment] skip reason=duplicate_comment page=${page.id} commentId=${data.commentId} — আগেই প্রসেস হয়েছে`);
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
    console.log(`[messenger-comment] skip reason=bot_disabled page=${page.id} — কমেন্ট লগ হয়েছে, কিন্তু রুল-ম্যাচিং হবে না`);
    await writeMessengerCommentSkip(supabase, {
      workspaceId: page.workspace_id,
      messengerPageId: page.id,
      commentId: data.commentId,
      postId: data.postId,
      fromPsid: data.fromPsid,
      commentText: data.commentText,
      reason: "bot_disabled",
    });
    return;
  }

  if (!data.commentText.trim()) {
    console.log(`[messenger-comment] skip reason=empty_text page=${page.id} commentId=${data.commentId} — খালি/শুধু-ছবি কমেন্ট`);
    return;
  }

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
    console.log(`[messenger-comment] skip reason=no_rule_matched page=${page.id} commentId=${data.commentId} — কোনো active রুলের কিওয়ার্ড/all মেলেনি`);
    await writeMessengerCommentSkip(supabase, {
      workspaceId: page.workspace_id,
      messengerPageId: page.id,
      commentId: data.commentId,
      postId: data.postId,
      fromPsid: data.fromPsid,
      commentText: data.commentText,
      reason: "rule_not_matched",
    });
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
    console.log(`[messenger-comment] skip reason=empty_reply_text rule=${matched.id} — AI স্কিপ করেছে বা খালি রিপ্লাই দিয়েছে`);
    return;
  }

  if (matched.action === "private_reply" && !data.fromPsid) {
    console.log(`[messenger-comment] skip reason=no_psid_for_private_reply rule=${matched.id} commentId=${data.commentId} — private_reply এর জন্য fromPsid লাগে, পাওয়া যায়নি`);
    return;
  }

  const skipCtx = {
    workspaceId: page.workspace_id,
    messengerPageId: page.id,
    commentId: data.commentId,
    postId: data.postId,
    fromPsid: data.fromPsid,
    commentText: data.commentText,
    replyText,
    matchedRuleId: matched.id,
    action: matched.action,
  } as const;

  let delayMs = 0;

  if (matched.action === "public_reply") {
    const perCustomerCount = await countMatchingComments(supabase, {
      fromPsid: data.fromPsid,
      postId: data.postId,
      action: "public_reply",
      sinceMinutesAgo: 60,
    });
    if (perCustomerCount >= MESSENGER_COMMENT_LIMITS.PUBLIC_REPLY_PER_CUSTOMER_POST_PER_HOUR) {
      console.log(`[messenger-comment] skip reason=limit_per_customer rule=${matched.id} commentId=${data.commentId} — এই কাস্টমার এই পোস্টে ঘণ্টায় সীমা ছাড়িয়েছে`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "limit_per_customer" });
      return;
    }

    const perPageCount = await countMatchingComments(supabase, {
      messengerPageId: page.id,
      action: "public_reply",
      sinceMinutesAgo: 60,
    });
    if (perPageCount >= MESSENGER_COMMENT_LIMITS.PUBLIC_REPLY_PER_PAGE_PER_HOUR) {
      console.log(`[messenger-comment] skip reason=limit_per_page rule=${matched.id} commentId=${data.commentId} — পেজের ঘণ্টায় পাবলিক রিপ্লাই সীমা ছাড়িয়েছে`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "limit_per_page" });
      return;
    }

    // drip queue (migration 0049) — cooldown প্রতি-কমেন্টকারী আলাদা, কখনো "স্কিপ" করে না,
    // শুধু পরের উপলব্ধ স্লট রিজার্ভ করে রিটার্ন করে
    const cooldownKey = data.fromPsid ?? "unknown";
    const { data: scheduledAtIso, error: slotError } = await supabase.rpc("reserve_comment_reply_slot", {
      p_rule_id: matched.id,
      p_from_psid: cooldownKey,
      p_cooldown_seconds: matched.cooldown_seconds,
    });

    if (slotError) {
      // স্লট রিজার্ভেশন ব্যর্থ হলেও (infra সমস্যা) রিপ্লাই আটকানো ঠিক না — delay ছাড়াই পাঠানো
      // হবে, non-critical হিসেবে লগ
      console.error(`[messenger-comment] cooldown slot reserve ব্যর্থ (non-critical, delay ছাড়াই পাঠানো হবে) rule=${matched.id}: ${slotError.message}`);
    } else if (scheduledAtIso) {
      delayMs = Math.max(0, new Date(scheduledAtIso).getTime() - Date.now());
    }

    // delay অনেক বেশি হয়ে গেলে (burst এ অনেক কমেন্ট জমে গেছে) এতক্ষণ পরে একটা রিপ্লাই পাঠানো
    // কাস্টমারের কাছে অপ্রাসঙ্গিক লাগতে পারে — কিউতে না বসিয়েই স্কিপ, রিভিউ-তালিকায় যাবে
    const maxDelayMs = MESSENGER_COMMENT_LIMITS.PUBLIC_REPLY_MAX_QUEUE_DELAY_MINUTES * 60 * 1000;
    if (delayMs > maxDelayMs) {
      console.log(`[messenger-comment] skip reason=cooldown_active rule=${matched.id} commentId=${data.commentId} — drip delay সর্বোচ্চ সীমার (${MESSENGER_COMMENT_LIMITS.PUBLIC_REPLY_MAX_QUEUE_DELAY_MINUTES} মিনিট) বেশি, কিউতে বসানো হলো না`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "cooldown_active" });
      return;
    }
  } else {
    // private_reply — কখনো delay হয় না, cap ছাড়ালে সরাসরি স্কিপ
    const sameRuleCount = await countMatchingComments(supabase, {
      matchedRuleId: matched.id,
      fromPsid: data.fromPsid,
      postId: data.postId,
      action: "private_reply",
    });
    if (sameRuleCount >= 1) {
      console.log(`[messenger-comment] skip reason=cooldown_active rule=${matched.id} commentId=${data.commentId} — এই রুল এই কাস্টমার+পোস্টে আগেই একবার private reply পাঠিয়েছে`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "cooldown_active" });
      return;
    }

    const totalForCustomerPost = await countMatchingComments(supabase, {
      fromPsid: data.fromPsid,
      postId: data.postId,
      action: "private_reply",
    });
    if (totalForCustomerPost >= MESSENGER_COMMENT_LIMITS.PRIVATE_REPLY_PER_CUSTOMER_POST_TOTAL) {
      console.log(`[messenger-comment] skip reason=private_limit rule=${matched.id} commentId=${data.commentId} — এই কাস্টমার+পোস্টে মোট private reply সীমা ছাড়িয়েছে`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "private_limit" });
      return;
    }

    const perPageCount = await countMatchingComments(supabase, {
      messengerPageId: page.id,
      action: "private_reply",
      sinceMinutesAgo: 60,
    });
    if (perPageCount >= MESSENGER_COMMENT_LIMITS.PRIVATE_REPLY_PER_PAGE_PER_HOUR) {
      console.log(`[messenger-comment] skip reason=limit_per_page rule=${matched.id} commentId=${data.commentId} — পেজের ঘণ্টায় private reply সীমা ছাড়িয়েছে`);
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "limit_per_page" });
      return;
    }
  }

  // last_triggered_at শুধু ড্যাশবোর্ডে "সর্বশেষ ট্রিগার" দেখানোর তথ্য — ব্যর্থ হলেও (non-critical)
  // শুধু লগ, রিপ্লাই আটকাবে না
  const { error: lastTriggeredError } = await supabase
    .from("messenger_comment_rules")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", matched.id);
  if (lastTriggeredError) {
    console.error(`[messenger-comment] last_triggered_at আপডেট ব্যর্থ (non-critical) rule=${matched.id}: ${lastTriggeredError.message}`);
  }

  const queuedAt = new Date().toISOString();

  if (inserted?.id) {
    const { error: updateError } = await supabase
      .from("messenger_comments")
      .update({ matched_rule_id: matched.id, action: matched.action, queued_at: queuedAt })
      .eq("id", inserted.id);
    if (updateError) console.error(`[messenger-comment] matched_rule_id/action আপডেট ব্যর্থ comment=${inserted.id}: ${updateError.message}`);
  }

  const replyJobData: MessengerCommentReplyJobData = {
    commentId: data.commentId,
    messengerPageId: page.id,
    postId: data.postId,
    fromPsid: data.fromPsid,
    action: matched.action,
    replyText,
    queuedAt,
  };
  await getMessengerJobsQueue().add("comment-reply", replyJobData, {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    ...(delayMs > 0 ? { delay: delayMs } : {}),
  });
  console.log(
    `[messenger-comment] reply job queued action=${matched.action} commentId=${data.commentId}` +
      (delayMs > 0 ? ` delay=${Math.round(delayMs / 1000)}s (drip queue)` : "")
  );
}
