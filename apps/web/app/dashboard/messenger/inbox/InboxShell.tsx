"use client";

import { usePathname } from "next/navigation";
import ConversationList from "./ConversationList";

type Conversation = {
  id: string;
  status: string;
  customer_name: string | null;
  psid: string;
  last_message_at: string;
  last_user_message_at: string | null;
  messenger_pages: { page_name: string | null } | { page_name: string | null }[] | null;
};

// WhatsApp ইনবক্সের InboxShell.tsx এর ঠিক একই প্যাটার্ন — /dashboard/messenger/inbox এ
// লিস্ট, /dashboard/messenger/inbox/[id] এ চ্যাট, ডেস্কটপে পাশাপাশি, মোবাইলে একটাই
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
  const isDetailView = pathname !== "/dashboard/messenger/inbox";

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      <div className={`w-full shrink-0 overflow-hidden md:block md:w-80 ${isDetailView ? "hidden" : "block"}`}>
        <ConversationList conversations={conversations} unreadIds={unreadIds} />
      </div>
      <div className={`min-w-0 flex-1 overflow-hidden md:block ${isDetailView ? "block" : "hidden"}`}>{children}</div>
    </div>
  );
}
