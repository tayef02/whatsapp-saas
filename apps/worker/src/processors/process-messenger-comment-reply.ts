import type { Job } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { writeMessengerCommentSkip } from "../lib/messenger-comment-skip";
import { MESSENGER_COMMENT_LIMITS } from "@whatsapp-saas/core/messenger/comment-limits";
import type { MessengerCommentReplyJobData } from "@whatsapp-saas/core/messenger/types";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

// ম্যাচ হওয়া রুলের রিপ্লাই পাঠানো — "messenger-jobs" queue তে "comment-reply" নামে। action
// অনুযায়ী পাবলিক কমেন্ট রিপ্লাই বা Private Reply (DM) — এই দুই পাথের টোকেন-ফেচ/এরর-হ্যান্ডলিং
// process-messenger-reply.ts এর ঠিক একই প্যাটার্ন। পুরো Job (শুধু job.data না) নেওয়া হয় কারণ
// job.attemptsMade/opts.attempts লাগে — সর্বশেষ অ্যাটেম্পটেও ব্যর্থ হলে reply_failed হিসেবে
// রিভিউ-তালিকায় রো লেখা দরকার, কিন্তু প্রতিটা retry attempt এ না (ডুপ্লিকেট এড়াতে)।
export async function processMessengerCommentReply(job: Job<MessengerCommentReplyJobData>) {
  const data = job.data;
  console.log(`[messenger-comment-reply] job started: action=${data.action} commentId=${data.commentId}`);

  const supabase = getSupabase();

  const { data: page } = await supabase
    .from("messenger_pages")
    .select("workspace_id")
    .eq("id", data.messengerPageId)
    .maybeSingle();

  const skipCtx = {
    workspaceId: page?.workspace_id ?? "",
    messengerPageId: data.messengerPageId,
    commentId: data.commentId,
    postId: data.postId,
    fromPsid: data.fromPsid,
    replyText: data.replyText,
    action: data.action,
  } as const;

  async function markSentManuallyIfApplicable() {
    if (!data.skipId) return;
    const { error } = await supabase
      .from("messenger_comment_skips")
      .update({ status: "sent_manually" })
      .eq("id", data.skipId);
    if (error) console.error(`[messenger-comment-reply] skip row sent_manually আপডেট ব্যর্থ skipId=${data.skipId}: ${error.message}`);
  }

  // infra backlog (Redis ডাউন, worker অনেকক্ষণ বন্ধ ইত্যাদি) এর কারণে queue তে বসানোর পর অনেক
  // দেরিতে প্রসেস হলে — এতক্ষণ পরে পাঠানো অপ্রাসঙ্গিক, রিভিউ-তালিকায় পাঠানো ভালো
  const ageMs = Date.now() - new Date(data.queuedAt).getTime();
  const staleLimitMs = MESSENGER_COMMENT_LIMITS.SEND_STALENESS_LIMIT_MINUTES * 60 * 1000;
  if (ageMs > staleLimitMs) {
    console.log(`[messenger-comment-reply] skip reason=queue_expired commentId=${data.commentId} — queue তে ${Math.round(ageMs / 60000)} মিনিট ধরে পড়েছিল`);
    if (page) await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "queue_expired" });
    return;
  }

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[messenger-comment-reply] MESSENGER_APP_ID/MESSENGER_APP_SECRET সেট করা নেই");
    return;
  }

  const { data: token, error: tokenError } = await supabase.rpc("get_messenger_page_token", { p_page_id: data.messengerPageId });
  if (tokenError) {
    console.error(`[messenger-comment-reply] token lookup failed page=${data.messengerPageId}: ${tokenError.message}`);
    throw new Error(`token lookup failed: ${tokenError.message}`);
  }
  if (!token) {
    console.error(`[messenger-comment-reply] no token for page=${data.messengerPageId}`);
    return;
  }

  const provider = new MetaMessengerProvider({ appId, appSecret });

  // কাস্টমার কমেন্ট ডিলিট করে দিতে পারে, বিশেষ করে drip-delay এর ফলে কিছুক্ষণ পরে পাঠানো
  // পাবলিক রিপ্লাইয়ের ক্ষেত্রে এই সম্ভাবনা বাস্তব — পাঠানোর ঠিক আগে যাচাই
  try {
    const exists = await provider.commentExists(token, data.commentId);
    if (!exists) {
      console.log(`[messenger-comment-reply] skip reason=comment_deleted commentId=${data.commentId}`);
      if (page) await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "comment_deleted" });
      return;
    }
  } catch (err) {
    // অনিশ্চিত (network/rate-limit) — fail-safe, পাঠানোর চেষ্টা চালিয়ে যাওয়া হচ্ছে
    console.warn(`[messenger-comment-reply] comment existence check অনিশ্চিত, পাঠানোর চেষ্টা চালিয়ে যাচ্ছি commentId=${data.commentId}:`, err instanceof Error ? err.message : err);
  }

  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

  try {
    if (data.action === "public_reply") {
      await provider.replyToComment(token, data.commentId, data.replyText);
    } else {
      if (!data.fromPsid) {
        console.error(`[messenger-comment-reply] private_reply এর জন্য psid নেই, commentId=${data.commentId}`);
        return;
      }
      await provider.sendPrivateReply(token, data.commentId, data.replyText);

      // সফল হলে স্বাভাবিক কথোপকথনের মতোই সেভ হয় — ইনবক্সে দেখা যাবে (M1/M2 এর ঠিক একই
      // conversation upsert + outbound message insert প্যাটার্ন)
      if (page) {
        const { data: conversation, error: convError } = await supabase
          .from("messenger_conversations")
          .upsert(
            {
              workspace_id: page.workspace_id,
              messenger_page_id: data.messengerPageId,
              psid: data.fromPsid,
              last_message_at: new Date().toISOString(),
            },
            { onConflict: "messenger_page_id,psid" }
          )
          .select("id")
          .maybeSingle();

        if (convError || !conversation) {
          console.error(`[messenger-comment-reply] conversation upsert failed page=${data.messengerPageId}: ${convError?.message}`);
        } else {
          const { error: msgError } = await supabase.from("messenger_messages").insert({
            conversation_id: conversation.id,
            direction: "outbound",
            sender_type: "bot",
            content: data.replyText,
          });
          if (msgError) console.error(`[messenger-comment-reply] outbound message insert failed conversation=${conversation.id}: ${msgError.message}`);
        }
      }
    }
  } catch (err) {
    const isAuthError = Boolean((err as { isAuthError?: boolean } | undefined)?.isAuthError);
    console.error(
      `[messenger-comment-reply] send failed action=${data.action} commentId=${data.commentId} authError=${isAuthError} finalAttempt=${isFinalAttempt}:`,
      err instanceof Error ? err.message : err
    );
    if (isAuthError) {
      const { error: statusError } = await supabase.from("messenger_pages").update({ status: "token_expired" }).eq("id", data.messengerPageId);
      if (statusError) console.error(`[messenger-comment-reply] status আপডেট ব্যর্থ page=${data.messengerPageId}: ${statusError.message}`);
      if (page) await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "reply_failed" });
      return;
    }
    // transient/network এরর — retry হওয়া উচিত, কিন্তু শেষ attempt এও ব্যর্থ হলে রিভিউ-তালিকায়
    // একটা রো লেখা দরকার (প্রতিটা retry attempt এ না, শুধু শেষবার — ডুপ্লিকেট এড়াতে)
    if (isFinalAttempt && page) {
      await writeMessengerCommentSkip(supabase, { ...skipCtx, reason: "reply_failed" });
    }
    throw err;
  }

  const { error: updateError } = await supabase
    .from("messenger_comments")
    .update({ reply_sent: true, reply_text: data.replyText })
    .eq("messenger_page_id", data.messengerPageId)
    .eq("comment_id", data.commentId);
  if (updateError) console.error(`[messenger-comment-reply] reply_sent আপডেট ব্যর্থ commentId=${data.commentId}: ${updateError.message}`);

  await markSentManuallyIfApplicable();

  console.log(`[messenger-comment-reply] sent action=${data.action} commentId=${data.commentId}`);
}
