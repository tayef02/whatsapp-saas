import { createClient } from "@/lib/supabase/server";
import InboxShell from "./InboxShell";

// WhatsApp ইনবক্সের layout.tsx (apps/web/app/dashboard/inbox/layout.tsx) এর ঠিক একই
// প্যাটার্ন — কথোপকথন তালিকা একবার এখানে ফেচ হয়ে বাঁ কলামে স্থায়ী থাকে, ডান পাশে {children}
export default async function MessengerInboxLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("messenger_conversations")
    .select("id, status, customer_name, psid, last_message_at, last_user_message_at, messenger_pages(page_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversationIds = (conversations ?? []).map((c) => c.id);

  // messenger_conversations এ কোনো "unread" কলাম নেই — WhatsApp ইনবক্সের একই heuristic:
  // সর্বশেষ মেসেজ inbound (কাস্টমার পাঠিয়েছে) হলে "উত্তর বাকি" ধরা হচ্ছে
  const unreadIds = new Set<string>();
  if (conversationIds.length > 0) {
    const { data: recentMessages } = await supabase
      .from("messenger_messages")
      .select("conversation_id, direction, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(2000);

    const seen = new Set<string>();
    for (const m of recentMessages ?? []) {
      if (seen.has(m.conversation_id)) continue;
      seen.add(m.conversation_id);
      if (m.direction === "inbound") unreadIds.add(m.conversation_id);
    }
  }

  return (
    <InboxShell conversations={conversations ?? []} unreadIds={Array.from(unreadIds)}>
      {children}
    </InboxShell>
  );
}
