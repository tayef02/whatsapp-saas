import { getSupabase } from "../lib/supabase";
import type { MessengerReplyJobData } from "@whatsapp-saas/core/messenger/types";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

// ইনবক্স থেকে এজেন্টের রিপ্লাই — messenger-jobs queue তে "reply" নামে আসে। WhatsApp এর
// sendAgentReply এর মতোই Next.js কখনো সরাসরি Graph API কল করে না, সবসময় এই queue দিয়ে যায়।
export async function processMessengerReply(data: MessengerReplyJobData) {
  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[messenger-reply] MESSENGER_APP_ID/MESSENGER_APP_SECRET সেট করা নেই");
    return;
  }

  const supabase = getSupabase();
  const { data: token, error: tokenError } = await supabase.rpc("get_messenger_page_token", { p_page_id: data.messengerPageId });

  if (tokenError) {
    console.error(`[messenger-reply] token lookup failed page=${data.messengerPageId}: ${tokenError.message}`);
    throw new Error(`token lookup failed: ${tokenError.message}`);
  }
  if (!token) {
    console.error(`[messenger-reply] no token for page=${data.messengerPageId}`);
    return;
  }

  const provider = new MetaMessengerProvider({ appId, appSecret });

  try {
    await provider.sendMessage(token, data.psid, data.replyText, "RESPONSE");
  } catch (err) {
    const isAuthError = Boolean((err as { isAuthError?: boolean } | undefined)?.isAuthError);
    console.error(
      `[messenger-reply] send failed page=${data.messengerPageId} authError=${isAuthError}:`,
      err instanceof Error ? err.message : err
    );
    if (isAuthError) {
      // token মেয়াদ শেষ/রিভোক — retry করে লাভ নেই, ইউজার আবার কানেক্ট না করা পর্যন্ত একই
      // এরর আসতেই থাকবে, তাই throw না করে status আপডেট করে থেমে যাওয়া হচ্ছে
      const { error: statusError } = await supabase.from("messenger_pages").update({ status: "token_expired" }).eq("id", data.messengerPageId);
      if (statusError) console.error(`[messenger-reply] status আপডেট ব্যর্থ page=${data.messengerPageId}: ${statusError.message}`);
      return;
    }
    throw err; // transient/network এরর — retry হওয়া উচিত
  }

  const { error: insertError } = await supabase.from("messenger_messages").insert({
    conversation_id: data.conversationId,
    direction: "outbound",
    sender_type: "agent",
    content: data.replyText,
  });

  if (insertError) {
    console.error(`[messenger-reply] outbound message insert failed conversation=${data.conversationId}: ${insertError.message}`);
    throw new Error(`outbound message insert failed: ${insertError.message}`);
  }

  const { error: convError } = await supabase
    .from("messenger_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", data.conversationId);
  if (convError) console.error(`[messenger-reply] last_message_at আপডেট ব্যর্থ conversation=${data.conversationId}: ${convError.message}`);

  console.log(`[messenger-reply] sent conversation=${data.conversationId}`);
}
