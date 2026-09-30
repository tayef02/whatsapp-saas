import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConversationThread from "./ConversationThread";

const WINDOW_HOURS = 24;

export default async function MessengerConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("messenger_conversations")
    .select("id, status, customer_name, psid, last_user_message_at, messenger_pages(page_name)")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messenger_messages")
    .select("id, direction, sender_type, content, media_type, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const page = Array.isArray(conversation.messenger_pages) ? conversation.messenger_pages[0] : conversation.messenger_pages;

  // ২৪ ঘণ্টার মেসেজিং উইন্ডো — কাস্টমারের সর্বশেষ (ইনবাউন্ড) মেসেজের সময় থেকে হিসাব।
  // last_user_message_at না থাকা মানে কখনো কাস্টমার মেসেজই করেনি (থিওরিটিক্যালি হয় না,
  // কিন্তু defensively windowHoursLeft=0 ধরা হচ্ছে — নিরাপদ দিকে, রিপ্লাই বক্স বন্ধ থাকবে)
  const hoursSinceLastUserMessage = conversation.last_user_message_at
    ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
    : Infinity;
  const windowHoursLeft = Math.max(0, WINDOW_HOURS - hoursSinceLastUserMessage);

  return (
    <ConversationThread
      conversationId={id}
      contactLabel={conversation.customer_name || conversation.psid}
      pageLabel={page?.page_name ?? ""}
      windowHoursLeft={windowHoursLeft}
      messages={messages ?? []}
    />
  );
}
