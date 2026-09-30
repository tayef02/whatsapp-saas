import { getSupabase } from "../lib/supabase";
import type { MessengerWebhookJobData } from "@whatsapp-saas/core/messenger/types";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

// Messenger এর attachment "type" এর বাংলা লেবেল — WhatsApp গ্রুপ/ইনবক্স মিডিয়ার
// MEDIA_LABEL_BN এর ঠিক একই স্টাইল। আসল ফাইল ডাউনলোড M2 তে, এই ধাপে (M1) শুধু প্লেসহোল্ডার।
const MEDIA_LABEL_BN: Record<string, string> = {
  image: "[ছবি পাঠিয়েছে]",
  video: "[ভিডিও পাঠিয়েছে]",
  audio: "[অডিও পাঠিয়েছে]",
  file: "[ফাইল পাঠিয়েছে]",
};

// Messenger থেকে ইনকামিং টেক্সট/মিডিয়া মেসেজ — messenger_conversations upsert,
// messenger_messages এ dedup সহ insert, নতুন কথোপকথনে কাস্টমারের নাম আনার চেষ্টা।
// এই ধাপে (M1) কোনো bot/AI রিপ্লাই নেই — শুধু সেভ করা হয়, ইনবক্সে এজেন্ট ম্যানুয়ালি উত্তর দেবে।
export async function processMessengerWebhookEvent(data: MessengerWebhookJobData) {
  if (!data.message) return; // messaging_postbacks ইত্যাদি অন্য ইভেন্ট টাইপ, M1 এ হ্যান্ডল হয় না

  const supabase = getSupabase();

  const { data: page, error: pageError } = await supabase
    .from("messenger_pages")
    .select("id, workspace_id")
    .eq("page_id", data.pageId)
    .maybeSingle();

  if (pageError) {
    console.error(`[messenger-webhook] messenger_pages lookup failed page=${data.pageId}: ${pageError.message}`);
    throw new Error(`messenger_pages lookup failed: ${pageError.message}`);
  }
  if (!page) {
    console.log(`[messenger-webhook] no connected page for page_id=${data.pageId}, skipping`);
    return;
  }

  let content = data.message.text ?? "";
  let mediaType: string | null = null;
  const attachment = data.message.attachments?.[0];
  if (!content && attachment) {
    mediaType = attachment.type;
    content = MEDIA_LABEL_BN[attachment.type] ?? `[${attachment.type} পাঠিয়েছে]`;
  }
  if (!content.trim()) return; // টেক্সট/attachment কিছুই নেই (sticker_id, quick_reply payload ইত্যাদি) — M1 এ হ্যান্ডল হয় না

  const { data: conversation, error: convError } = await supabase
    .from("messenger_conversations")
    .upsert(
      {
        workspace_id: page.workspace_id,
        messenger_page_id: page.id,
        psid: data.senderPsid,
        last_message_at: new Date().toISOString(),
        last_user_message_at: new Date().toISOString(),
      },
      { onConflict: "messenger_page_id,psid" }
    )
    .select("id, customer_name")
    .maybeSingle();

  if (convError || !conversation) {
    console.error(`[messenger-webhook] messenger_conversations upsert failed page=${page.id}: ${convError?.message}`);
    throw new Error(`messenger_conversations upsert failed: ${convError?.message ?? "unknown"}`);
  }

  // নতুন কথোপকথনে কাস্টমারের নাম Graph API থেকে আনার চেষ্টা — getUserProfile() নিজেই সব
  // এরর ধরে null রিটার্ন করে (messenger.ts), তাই এখানে try/catch লাগছে না
  if (!conversation.customer_name) {
    const appId = process.env.MESSENGER_APP_ID;
    const appSecret = process.env.MESSENGER_APP_SECRET;
    if (appId && appSecret) {
      const { data: token } = await supabase.rpc("get_messenger_page_token", { p_page_id: page.id });
      if (token) {
        const provider = new MetaMessengerProvider({ appId, appSecret });
        const { name } = await provider.getUserProfile(token, data.senderPsid);
        if (name) {
          const { error: nameError } = await supabase.from("messenger_conversations").update({ customer_name: name }).eq("id", conversation.id);
          if (nameError) console.error(`[messenger-webhook] customer_name আপডেট ব্যর্থ conversation=${conversation.id}: ${nameError.message}`);
        }
      }
    }
  }

  const { error: insertError } = await supabase.from("messenger_messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    sender_type: "customer",
    content,
    media_type: mediaType,
    provider_message_id: data.message.mid,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(`[messenger-webhook] duplicate message ignored conversation=${conversation.id}`);
      return;
    }
    console.error(`[messenger-webhook] messenger_messages insert failed conversation=${conversation.id}: ${insertError.message}`);
    throw new Error(`messenger_messages insert failed: ${insertError.message}`);
  }

  console.log(`[messenger-webhook] saved inbound message conversation=${conversation.id}`);
}
