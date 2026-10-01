import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationThread from "./ConversationThread";

const INBOX_MEDIA_BUCKET = "inbox-media";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, status, contacts(name, phone), whatsapp_numbers(display_name, bot_enabled)")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, direction, sender_type, content, media_path, media_type, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const number = Array.isArray(conversation.whatsapp_numbers) ? conversation.whatsapp_numbers[0] : conversation.whatsapp_numbers;

  // media_path এ শুধু storage path সেভ থাকে (bucket প্রাইভেট) — admin client দিয়ে সাইন করা
  // URL বানানো হয়, কনভারসেশন-ownership আগেই উপরের RLS-স্কোপড কোয়েরিতে যাচাই হয়ে গেছে
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
      contactLabel={contact?.name || contact?.phone || "(অজানা)"}
      numberLabel={number?.display_name ?? ""}
      botEnabled={number?.bot_enabled ?? true}
      messages={messagesWithMediaUrl}
    />
  );
}
