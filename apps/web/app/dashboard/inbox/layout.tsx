import { createClient } from "@/lib/supabase/server";
import InboxShell from "./InboxShell";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, last_read_at, contacts(name, phone), whatsapp_numbers(display_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversationIds = (conversations ?? []).map((c) => c.id);

  // দুটো আলাদা ধারণা (ট্যাবও আলাদা):
  //  • "অপঠিত"     = কাস্টমারের সর্বশেষ ইনবাউন্ড মেসেজ last_read_at এর পরে (বা last_read_at NULL) —
  //                  কেউ কথোপকথনটা খুলে দেখেনি। last_read_at খোলার সময় বসে (markConversationRead)।
  //  • "উত্তর বাকি" = কথোপকথনের সর্বশেষ মেসেজটাই ইনবাউন্ড — কেউ রিপ্লাই দেয়নি (খুলে দেখলেও
  //                  যতক্ষণ রিপ্লাই যায়নি এটা থাকবে)।
  // conversations এ "শেষ ইনবাউন্ডের সময়" কলাম নেই, তাই আগের মতোই conversation_messages থেকে
  // সাম্প্রতিক মেসেজ এনে প্রতিটা কথোপকথনের সবচেয়ে নতুন মেসেজ ও সবচেয়ে নতুন ইনবাউন্ড বের করা হয়।
  const awaitingReplyIds = new Set<string>();
  const unreadIds = new Set<string>();
  if (conversationIds.length > 0) {
    const { data: recentMessages, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("conversation_id, direction, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (messagesError) console.error(`[inbox layout] conversation_messages পড়া ব্যর্থ: ${messagesError.message}`);

    const lastReadById = new Map((conversations ?? []).map((c) => [c.id, c.last_read_at ? new Date(c.last_read_at).getTime() : 0]));
    const seenLatest = new Set<string>();
    const seenInbound = new Set<string>();
    for (const m of recentMessages ?? []) {
      // নতুন → পুরনো ক্রমে আসছে, তাই প্রতিটা কথোপকথনের প্রথম রো-ই সবচেয়ে নতুন
      if (!seenLatest.has(m.conversation_id)) {
        seenLatest.add(m.conversation_id);
        if (m.direction === "inbound") awaitingReplyIds.add(m.conversation_id);
      }
      if (m.direction === "inbound" && !seenInbound.has(m.conversation_id)) {
        seenInbound.add(m.conversation_id);
        if (new Date(m.created_at).getTime() > (lastReadById.get(m.conversation_id) ?? 0)) unreadIds.add(m.conversation_id);
      }
    }
  }

  return (
    <InboxShell conversations={conversations ?? []} unreadIds={Array.from(unreadIds)} awaitingReplyIds={Array.from(awaitingReplyIds)}>
      {children}
    </InboxShell>
  );
}
