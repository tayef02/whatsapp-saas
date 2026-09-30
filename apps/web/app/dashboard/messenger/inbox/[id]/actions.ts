"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMessengerJobsQueue } from "@/lib/queue/messenger-jobs-queue";
import type { MessengerReplyJobData } from "@whatsapp-saas/core/messenger/types";

const WINDOW_HOURS = 24;

// এজেন্টের রিপ্লাইও queue দিয়েই যায় — Next.js থেকে কখনো সরাসরি Graph API কল না
// (WhatsApp এর একই আর্কিটেকচার নিয়ম, Messenger এও প্রযোজ্য)
export async function sendAgentReply(conversationId: string, formData: FormData) {
  const supabase = await createClient();

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "কিছু লিখুন" };

  // RLS-স্কোপড সিলেক্ট — ownership এখানেই যাচাই হয়ে যায়
  const { data: conversation } = await supabase
    .from("messenger_conversations")
    .select("id, psid, messenger_page_id, last_user_message_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "কথোপকথন পাওয়া যায়নি" };

  // সার্ভার-সাইডেও ২৪-ঘণ্টা উইন্ডো যাচাই — UI তে বক্স বন্ধ থাকলেও কেউ সরাসরি action কল
  // করলে যেন আটকানো যায়
  const hoursSinceLastUserMessage = conversation.last_user_message_at
    ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
    : Infinity;
  if (hoursSinceLastUserMessage >= WINDOW_HOURS) {
    return { error: "২৪ ঘণ্টার মেসেজিং উইন্ডো শেষ হয়ে গেছে — এই মুহূর্তে রিপ্লাই পাঠানো যাবে না।" };
  }

  const jobData: MessengerReplyJobData = {
    conversationId: conversation.id,
    messengerPageId: conversation.messenger_page_id,
    psid: conversation.psid,
    replyText: text,
  };

  await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });

  revalidatePath(`/dashboard/messenger/inbox/${conversationId}`);
  return { error: null };
}
