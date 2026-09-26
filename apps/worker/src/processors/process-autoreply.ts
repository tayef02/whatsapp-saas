import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import { createNotification } from "../lib/notify";
import type { AutoReplyJobData } from "@whatsapp-saas/core/chatbot/types";

// keyword rule/fallback ম্যাচ হলে webhook handler এই job বসায়। এখানে আসল sendMessage
// কল হয় — সফল হলেই conversation_messages এ লেখা হয়, ব্যর্থ হলে BullMQ নিজের রিট্রাই করবে
export async function processAutoReply(data: AutoReplyJobData) {
  console.log(`[autoreply-worker] job শুরু: conversation=${data.conversationId} phone=${data.phone} senderType=${data.senderType ?? "bot"}`);

  const supabase = getSupabase();
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);

  if (!providerInfo) {
    console.error(`[autoreply-worker] নাম্বার ${data.whatsappNumberId} এর provider পাওয়া যায়নি, স্কিপ`);
    return;
  }

  await providerInfo.provider.sendMessage(providerInfo.instanceName, data.phone, data.replyText);
  console.log(`[autoreply-worker] sendMessage সফল, conversation=${data.conversationId}`);

  await supabase.from("conversation_messages").insert({
    conversation_id: data.conversationId,
    direction: "outbound",
    sender_type: data.senderType ?? "bot",
    content: data.replyText,
  });

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      ...(data.markHandedOff && { status: "handed_off" }),
    })
    .eq("id", data.conversationId);

  if (data.markHandedOff) {
    await createNotification(
      data.workspaceId,
      "conversation_handed_off",
      "একটা কথোপকথনে এজেন্টের সাহায্য দরকার",
      "কাস্টমারের মেসেজের সাথে কোনো auto-reply rule মেলেনি — Inbox এ গিয়ে দেখুন।"
    );
  }
}
