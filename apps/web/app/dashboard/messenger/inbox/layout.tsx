import { createClient } from "@/lib/supabase/server";
import InboxShell from "./InboxShell";

// WhatsApp ইনবক্সের layout.tsx (apps/web/app/dashboard/inbox/layout.tsx) এর ঠিক একই
// প্যাটার্ন — কথোপকথন তালিকা একবার এখানে ফেচ হয়ে বাঁ কলামে স্থায়ী থাকে, ডান পাশে {children}
export default async function MessengerInboxLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("messenger_conversations")
    .select("id, status, customer_name, psid, last_message_at, last_user_message_at, last_read_at, messenger_pages(page_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversationIds = (conversations ?? []).map((c) => c.id);

  // WhatsApp ইনবক্সের মতোই দুটো আলাদা ধারণা:
  //  • "অপঠিত"     = কাস্টমারের শেষ ইনবাউন্ড মেসেজ (last_user_message_at — এই টেবিলে আগে থেকেই
  //                  আছে, শুধু ইনবাউন্ডে আপডেট হয়) last_read_at এর পরে, বা last_read_at NULL
  //  • "উত্তর বাকি" = সর্বশেষ মেসেজই ইনবাউন্ড (কেউ রিপ্লাই দেয়নি)
  const unreadIds = (conversations ?? [])
    .filter((c) => {
      if (!c.last_user_message_at) return false;
      if (!c.last_read_at) return true;
      return new Date(c.last_user_message_at).getTime() > new Date(c.last_read_at).getTime();
    })
    .map((c) => c.id);

  const awaitingReplyIds = new Set<string>();
  if (conversationIds.length > 0) {
    const { data: recentMessages, error: messagesError } = await supabase
      .from("messenger_messages")
      .select("conversation_id, direction, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (messagesError) console.error(`[messenger inbox layout] messenger_messages পড়া ব্যর্থ: ${messagesError.message}`);

    const seen = new Set<string>();
    for (const m of recentMessages ?? []) {
      if (seen.has(m.conversation_id)) continue;
      seen.add(m.conversation_id);
      if (m.direction === "inbound") awaitingReplyIds.add(m.conversation_id);
    }
  }

  return (
    <InboxShell conversations={conversations ?? []} unreadIds={unreadIds} awaitingReplyIds={Array.from(awaitingReplyIds)}>
      {children}
    </InboxShell>
  );
}
