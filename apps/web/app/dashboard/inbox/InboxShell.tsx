"use client";

import { usePathname } from "next/navigation";
import ConversationList from "./ConversationList";

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  contacts: { name: string | null; phone: string } | { name: string | null; phone: string }[] | null;
  whatsapp_numbers: { display_name: string | null } | { display_name: string | null }[] | null;
};

// /dashboard/inbox (লিস্ট) আর /dashboard/inbox/[id] (চ্যাট) — দুটোই আলাদা রুট, কিন্তু এই শেল
// দুটোকে পাশাপাশি একই স্ক্রিনে দেখায় (ডেস্কটপে)। মোবাইলে একবারে একটাই দেখা যাবে — pathname
// দেখে বোঝা হচ্ছে কোনটা: /dashboard/inbox এ থাকলে লিস্ট, নাহলে (কোনো [id] এ) চ্যাট।
export default function InboxShell({
  conversations,
  unreadIds,
  children,
}: {
  conversations: Conversation[];
  unreadIds: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDetailView = pathname !== "/dashboard/inbox";

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      <div className={`w-full shrink-0 overflow-hidden md:block md:w-80 ${isDetailView ? "hidden" : "block"}`}>
        <ConversationList conversations={conversations} unreadIds={unreadIds} />
      </div>
      <div className={`min-w-0 flex-1 overflow-hidden md:block ${isDetailView ? "block" : "hidden"}`}>{children}</div>
    </div>
  );
}
