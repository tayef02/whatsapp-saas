import { createClient } from "@/lib/supabase/server";
import InboxShell from "./InboxShell";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, contacts(name, phone), whatsapp_numbers(display_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversationIds = (conversations ?? []).map((c) => c.id);

  // conversations টেবিলে কোনো "unread" কলাম নেই (schema বদলানো এই ধাপে বারণ) — তাই "অপঠিত"
  // বোঝানো হচ্ছে বিদ্যমান ডাটা থেকেই: কথোপকথনের সর্বশেষ মেসেজ inbound (কাস্টমার পাঠিয়েছে) হলে
  // ধরে নেওয়া হচ্ছে এখনো রিপ্লাই/দেখা হয়নি। conversation_messages থেকে সাম্প্রতিক সময় অনুযায়ী
  // এনে প্রতিটা conversation এর সবচেয়ে নতুন রো (প্রথমটা) রাখা হচ্ছে।
  const unreadIds = new Set<string>();
  if (conversationIds.length > 0) {
    const { data: recentMessages } = await supabase
      .from("conversation_messages")
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
