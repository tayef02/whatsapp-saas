import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import type { MessengerReplyJobData } from "@whatsapp-saas/core/messenger/types";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const STANDARD_WINDOW_HOURS = 24;
const HUMAN_AGENT_WINDOW_HOURS = 24 * 7;

// ইনবক্স থেকে এজেন্টের রিপ্লাই, AI বট রিপ্লাই, আর অর্ডার-স্ট্যাটাস নোটিফিকেশন — তিনটাই এই
// একই job এ আসে (WhatsApp এর processAutoReply এর ঠিক একই শেয়ার্ড-জব প্যাটার্ন)। Next.js এখান
// থেকেই সব Messenger মেসেজ পাঠায়, কখনো সরাসরি Graph API কল করে না।
export async function processMessengerReply(data: MessengerReplyJobData) {
  console.log(`[messenger-reply] job started: conversation=${data.conversationId} senderType=${data.senderType}`);

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[messenger-reply] MESSENGER_APP_ID/MESSENGER_APP_SECRET সেট করা নেই");
    return;
  }

  const supabase = getSupabase();

  // send-time এ আবার window যাচাই — caller (web action/AI webhook processor) নিজের দিক থেকে
  // ইতিমধ্যে একবার চেক করেছে (UI/অর্ডার-ওয়ার্নিং এর জন্য), কিন্তু queue তে কিছুক্ষণ বসে থাকলে
  // (backlog) ততক্ষণে উইন্ডো বদলে যেতে পারে — তাই আসল সিদ্ধান্ত এখানেই, send এর ঠিক আগে
  const { data: conversation, error: convError } = await supabase
    .from("messenger_conversations")
    .select("last_user_message_at")
    .eq("id", data.conversationId)
    .maybeSingle();

  if (convError) {
    console.error(`[messenger-reply] messenger_conversations lookup failed conversation=${data.conversationId}: ${convError.message}`);
    throw new Error(`messenger_conversations lookup failed: ${convError.message}`);
  }

  const hoursSinceLastUserMessage = conversation?.last_user_message_at
    ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
    : Infinity;

  let messagingType: "RESPONSE" | "MESSAGE_TAG";
  let tag: "HUMAN_AGENT" | undefined;

  if (hoursSinceLastUserMessage < STANDARD_WINDOW_HOURS) {
    messagingType = "RESPONSE";
  } else if (data.allowHumanAgentTag && hoursSinceLastUserMessage < HUMAN_AGENT_WINDOW_HOURS) {
    messagingType = "MESSAGE_TAG";
    tag = "HUMAN_AGENT";
  } else {
    // উইন্ডো (আর প্রযোজ্য হলে Human Agent উইন্ডোও) শেষ — এটা permanent অবস্থা (retry করলে
    // ঠিক হবে না, কাস্টমার নতুন মেসেজ না পাঠানো পর্যন্ত), তাই throw না করে চুপচাপ স্কিপ
    console.log(
      `[messenger-reply] window closed (hoursSince=${hoursSinceLastUserMessage.toFixed(1)}, allowHumanAgentTag=${data.allowHumanAgentTag}), skipping send conversation=${data.conversationId}`
    );
    return;
  }

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

  // মানুষ-এজেন্টের মতো অনুভূতি দেওয়ার জন্য রিপ্লাইয়ের ঠিক আগে "টাইপ করছে..." (১-২ সেকেন্ড
  // র‍্যান্ডম ডিলে) — WhatsApp এর processAutoReply এর ঠিক একই প্যাটার্ন। কসমেটিক, ব্যর্থ হলেও
  // sendTypingOn নিজে throw করে না (messenger.ts দেখুন)
  await provider.sendTypingOn(token, data.psid);
  const typingDelayMs = 1000 + Math.floor(Math.random() * 1000);
  await new Promise((resolve) => setTimeout(resolve, typingDelayMs));

  try {
    await provider.sendMessage(token, data.psid, data.replyText, messagingType, tag);
  } catch (err) {
    const isAuthError = Boolean((err as { isAuthError?: boolean } | undefined)?.isAuthError);
    const isTagError = Boolean((err as { isTagError?: boolean } | undefined)?.isTagError);
    console.error(
      `[messenger-reply] send failed page=${data.messengerPageId} messagingType=${messagingType} authError=${isAuthError} tagError=${isTagError}:`,
      err instanceof Error ? err.message : err
    );

    if (isAuthError) {
      // token মেয়াদ শেষ/রিভোক — retry করে লাভ নেই, ইউজার আবার কানেক্ট না করা পর্যন্ত একই
      // এরর আসতেই থাকবে, তাই throw না করে status আপডেট করে থেমে যাওয়া হচ্ছে
      const { error: statusError } = await supabase.from("messenger_pages").update({ status: "token_expired" }).eq("id", data.messengerPageId);
      if (statusError) console.error(`[messenger-reply] status আপডেট ব্যর্থ page=${data.messengerPageId}: ${statusError.message}`);
      return;
    }

    if (isTagError) {
      // HUMAN_AGENT ট্যাগ Meta App Review এ এখনো approve হয়নি — এটাও retry করে ঠিক হবে না
      // (App Review পাস না হওয়া পর্যন্ত একই এরর আসতেই থাকবে), তাই ইউজারকে in-app নোটিফিকেশনে
      // বাংলায় বুঝিয়ে দিয়ে থেমে যাওয়া হচ্ছে — raw Graph এরর উপরেই লগ হয়ে গেছে
      const { data: page } = await supabase.from("messenger_pages").select("workspace_id").eq("id", data.messengerPageId).maybeSingle();
      if (page) {
        await createNotification(
          page.workspace_id,
          "conversation_handed_off",
          "Messenger এ রিপ্লাই পাঠানো যায়নি",
          "messenger",
          "Meta এখনো 'Human Agent' মেসেজ ট্যাগ অনুমোদন করেনি (২৪ ঘণ্টার উইন্ডো পার হওয়া কথোপকথনে রিপ্লাই পাঠাতে এটা লাগে) — এই ফিচার ব্যবহার করতে Meta App Review থেকে অনুমোদন লাগবে। কাস্টমার নতুন মেসেজ পাঠালে উইন্ডো আবার খুলবে, তখন স্বাভাবিকভাবে রিপ্লাই পাঠানো যাবে।"
        );
      }
      return;
    }

    throw err; // transient/network এরর — retry হওয়া উচিত
  }

  const { error: insertError } = await supabase.from("messenger_messages").insert({
    conversation_id: data.conversationId,
    direction: "outbound",
    sender_type: data.senderType,
    content: data.replyText,
  });

  if (insertError) {
    console.error(`[messenger-reply] outbound message insert failed conversation=${data.conversationId}: ${insertError.message}`);
    throw new Error(`outbound message insert failed: ${insertError.message}`);
  }

  const { error: convUpdateError } = await supabase
    .from("messenger_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      ...(data.markHandedOff && { status: "handed_off" }),
    })
    .eq("id", data.conversationId);
  if (convUpdateError) console.error(`[messenger-reply] conversation আপডেট ব্যর্থ conversation=${data.conversationId}: ${convUpdateError.message}`);

  console.log(`[messenger-reply] sent conversation=${data.conversationId} messagingType=${messagingType}`);
}
