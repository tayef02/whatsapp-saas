"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMessengerJobsQueue } from "@/lib/queue/messenger-jobs-queue";
import type { MessengerReplyJobData } from "@whatsapp-saas/core/messenger/types";

const HUMAN_AGENT_WINDOW_HOURS = 24 * 7;

// এজেন্টের রিপ্লাইও queue দিয়েই যায় — Next.js থেকে কখনো সরাসরি Graph API কল না (WhatsApp এর
// একই আর্কিটেকচার নিয়ম, Messenger এও প্রযোজ্য)। ইনবক্সের ম্যানুয়াল এজেন্ট রিপ্লাই হলো একমাত্র
// জায়গা যেখানে HUMAN_AGENT ট্যাগ (৭ দিন পর্যন্ত, ২৪ ঘণ্টার উইন্ডো শেষ হওয়ার পরেও) অনুমোদিত —
// AI বট/অর্ডার-নোটিফিকেশনে এটা false থাকে (process-messenger-reply.ts এই ফ্ল্যাগ দেখে
// messagingType/tag ঠিক করে, send-time এ আবার window যাচাই করে)
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

  // সার্ভার-সাইডেও ৭-দিনের উইন্ডো যাচাই (Human Agent ট্যাগ সহ) — UI তে বক্স বন্ধ থাকলেও কেউ
  // সরাসরি action কল করলে যেন আটকানো যায়
  const hoursSinceLastUserMessage = conversation.last_user_message_at
    ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
    : Infinity;
  if (hoursSinceLastUserMessage >= HUMAN_AGENT_WINDOW_HOURS) {
    return { error: "৭ দিনের মেসেজিং উইন্ডো শেষ হয়ে গেছে — কাস্টমার আবার মেসেজ না করা পর্যন্ত রিপ্লাই পাঠানো যাবে না।" };
  }

  const jobData: MessengerReplyJobData = {
    conversationId: conversation.id,
    messengerPageId: conversation.messenger_page_id,
    psid: conversation.psid,
    replyText: text,
    senderType: "agent",
    allowHumanAgentTag: true,
    markHandedOff: false,
  };

  await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });

  revalidatePath(`/dashboard/messenger/inbox/${conversationId}`);
  return { error: null };
}

// WhatsApp ইনবক্সের setConversationStatus এর ঠিক একই প্যাটার্ন — "Auto-Reply আবার চালু করুন"
// (handed_off → active) ও "সমাধান হয়েছে" (→ resolved) বাটনে ব্যবহার হয়
export async function setMessengerConversationStatus(conversationId: string, status: "active" | "resolved") {
  const supabase = await createClient();
  const { error } = await supabase.from("messenger_conversations").update({ status }).eq("id", conversationId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/messenger/inbox/${conversationId}`);
  revalidatePath("/dashboard/messenger/inbox");
  return { error: null };
}

// WhatsApp ইনবক্সের markConversationRead এর Messenger-নিজস্ব সংস্করণ (আলাদা টেবিল, আলাদা
// revalidate স্কোপ) — কথোপকথন খুললে "পঠিত" চিহ্নিত
export async function markMessengerConversationRead(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("messenger_conversations").update({ last_read_at: new Date().toISOString() }).eq("id", conversationId);
  if (error) {
    console.error(`[messenger-inbox] markMessengerConversationRead ব্যর্থ conversation=${conversationId}: ${error.message}`);
    return { error: error.message };
  }
  revalidatePath("/dashboard/messenger/inbox", "layout");
  return { error: null };
}
