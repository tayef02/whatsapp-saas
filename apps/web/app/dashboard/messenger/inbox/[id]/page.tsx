import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationThread from "./ConversationThread";

const WINDOW_HOURS = 24;
const HUMAN_AGENT_WINDOW_HOURS = 24 * 7;
const INBOX_MEDIA_BUCKET = "inbox-media";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

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
    .select("id, direction, sender_type, content, media_path, media_type, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const page = Array.isArray(conversation.messenger_pages) ? conversation.messenger_pages[0] : conversation.messenger_pages;

  // ২৪ ঘণ্টার RESPONSE উইন্ডো আর ৭ দিনের Human Agent উইন্ডো — দুটোই কাস্টমারের সর্বশেষ
  // (ইনবাউন্ড) মেসেজের সময় থেকে হিসাব। last_user_message_at না থাকা মানে কখনো কাস্টমার
  // মেসেজই করেনি (থিওরিটিক্যালি হয় না, কিন্তু defensively ০ ধরা হচ্ছে — নিরাপদ দিকে)
  const hoursSinceLastUserMessage = conversation.last_user_message_at
    ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
    : Infinity;
  const windowHoursLeft = Math.max(0, WINDOW_HOURS - hoursSinceLastUserMessage);
  const humanAgentHoursLeft = Math.max(0, HUMAN_AGENT_WINDOW_HOURS - hoursSinceLastUserMessage);

  // media_path এ শুধু storage path সেভ থাকে (bucket প্রাইভেট) — admin client দিয়ে সাইন করা
  // URL বানানো হয়, conversation-ownership আগেই উপরের RLS-স্কোপড কোয়েরিতে যাচাই হয়ে গেছে।
  // WhatsApp ইনবক্সের ঠিক একই bucket/প্যাটার্ন, শুধু path এ "messenger/" প্রিফিক্স থাকে
  const mediaPaths = (messages ?? []).map((m) => m.media_path).filter((p): p is string => Boolean(p));
  const signedUrlByPath = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const admin = createAdminClient();
    const { data: signedUrls } = await admin.storage.from(INBOX_MEDIA_BUCKET).createSignedUrls(mediaPaths, SIGNED_URL_EXPIRY_SECONDS);
    for (const s of signedUrls ?? []) {
      if (s.path && s.signedUrl) signedUrlByPath.set(s.path, s.signedUrl);
    }
  }

  const messagesWithMediaUrl = (messages ?? []).map((m) => ({
    ...m,
    media_url: m.media_path ? (signedUrlByPath.get(m.media_path) ?? null) : null,
  }));

  return (
    <ConversationThread
      conversationId={id}
      status={conversation.status}
      contactLabel={conversation.customer_name || conversation.psid}
      pageLabel={page?.page_name ?? ""}
      windowHoursLeft={windowHoursLeft}
      humanAgentHoursLeft={humanAgentHoursLeft}
      messages={messagesWithMediaUrl}
    />
  );
}
