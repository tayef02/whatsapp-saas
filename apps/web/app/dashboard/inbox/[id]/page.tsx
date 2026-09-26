import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConversationThread from "./ConversationThread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, status, contacts(name, phone), whatsapp_numbers(display_name)")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, direction, sender_type, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const number = Array.isArray(conversation.whatsapp_numbers) ? conversation.whatsapp_numbers[0] : conversation.whatsapp_numbers;

  return (
    <ConversationThread
      conversationId={id}
      status={conversation.status}
      contactLabel={contact?.name || contact?.phone || "(অজানা)"}
      numberLabel={number?.display_name ?? ""}
      messages={messages ?? []}
    />
  );
}
