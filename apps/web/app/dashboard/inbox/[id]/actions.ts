"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAutoReplyQueue } from "@/lib/queue/autoreply-queue";
import type { AutoReplyJobData } from "@whatsapp-saas/core/chatbot/types";

// এজেন্টের ম্যানুয়াল রিপ্লাইও queue দিয়েই যায় — Next.js থেকে কখনো সরাসরি Evolution কল না
export async function sendAgentReply(conversationId: string, formData: FormData) {
  const supabase = await createClient();

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "কিছু লিখুন" };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id, whatsapp_number_id, contacts(phone)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "কথোপকথন পাওয়া যায়নি" };

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  if (!contact?.phone) return { error: "কন্টাক্টের নাম্বার পাওয়া যায়নি" };

  const jobData: AutoReplyJobData = {
    conversationId: conversation.id,
    workspaceId: conversation.workspace_id,
    whatsappNumberId: conversation.whatsapp_number_id,
    phone: contact.phone,
    replyText: text,
    markHandedOff: false,
    senderType: "agent",
  };

  await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });

  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { error: null };
}

export async function setConversationStatus(conversationId: string, status: "active" | "resolved") {
  const supabase = await createClient();
  const { error } = await supabase.from("conversations").update({ status }).eq("id", conversationId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/inbox");
  return { error: null };
}
