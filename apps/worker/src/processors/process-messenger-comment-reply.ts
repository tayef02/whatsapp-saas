import { getSupabase } from "../lib/supabase";
import type { MessengerCommentReplyJobData } from "@whatsapp-saas/core/messenger/types";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

// ম্যাচ হওয়া রুলের রিপ্লাই পাঠানো — "messenger-jobs" queue তে "comment-reply" নামে। action
// অনুযায়ী পাবলিক কমেন্ট রিপ্লাই বা Private Reply (DM) — এই দুই পাথের টোকেন-ফেচ/এরর-হ্যান্ডলিং
// process-messenger-reply.ts এর ঠিক একই প্যাটার্ন।
export async function processMessengerCommentReply(data: MessengerCommentReplyJobData) {
  console.log(`[messenger-comment-reply] job started: action=${data.action} commentId=${data.commentId}`);

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[messenger-comment-reply] MESSENGER_APP_ID/MESSENGER_APP_SECRET সেট করা নেই");
    return;
  }

  const supabase = getSupabase();

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
      const { data: page } = await supabase.from("messenger_pages").select("workspace_id").eq("id", data.messengerPageId).maybeSingle();
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
      `[messenger-comment-reply] send failed action=${data.action} commentId=${data.commentId} authError=${isAuthError}:`,
      err instanceof Error ? err.message : err
    );
    if (isAuthError) {
      const { error: statusError } = await supabase.from("messenger_pages").update({ status: "token_expired" }).eq("id", data.messengerPageId);
      if (statusError) console.error(`[messenger-comment-reply] status আপডেট ব্যর্থ page=${data.messengerPageId}: ${statusError.message}`);
      return;
    }
    throw err; // transient/network এরর — retry হওয়া উচিত
  }

  const { error: updateError } = await supabase
    .from("messenger_comments")
    .update({ reply_sent: true, reply_text: data.replyText })
    .eq("messenger_page_id", data.messengerPageId)
    .eq("comment_id", data.commentId);
  if (updateError) console.error(`[messenger-comment-reply] reply_sent আপডেট ব্যর্থ commentId=${data.commentId}: ${updateError.message}`);

  console.log(`[messenger-comment-reply] sent action=${data.action} commentId=${data.commentId}`);
}
