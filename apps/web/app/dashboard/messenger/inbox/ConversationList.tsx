"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Card, Badge, EmptyState, Pagination } from "@/components/ui";
import { MessageSquare } from "lucide-react";
import { formatDhakaDateTime } from "@/lib/format-date";

type Conversation = {
  id: string;
  status: string;
  customer_name: string | null;
  psid: string;
  last_message_at: string;
  last_user_message_at: string | null;
  last_read_at?: string | null;
  messenger_pages: { page_name: string | null } | { page_name: string | null }[] | null;
};

type Filter = "all" | "unread" | "awaiting";

// WhatsApp ইনবক্সের ConversationList.tsx এর একই কারণে ক্লায়েন্ট-সাইড পেজিনেশন (layout.tsx
// এ একবারে .limit(100) ফেচ হয়ে prop আসে)
const PAGE_SIZE = 20;

export default function ConversationList({
  conversations,
  unreadIds,
  awaitingReplyIds,
}: {
  conversations: Conversation[];
  unreadIds: string[];
  awaitingReplyIds: string[];
}) {
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const unreadSet = new Set(unreadIds);
  const awaitingSet = new Set(awaitingReplyIds);

  const unreadCount = conversations.filter((c) => unreadSet.has(c.id)).length;
  const awaitingCount = conversations.filter((c) => awaitingSet.has(c.id)).length;
  const filtered =
    filter === "unread"
      ? conversations.filter((c) => unreadSet.has(c.id))
      : filter === "awaiting"
        ? conversations.filter((c) => awaitingSet.has(c.id))
        : conversations;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilterChange(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2">
        <FilterTab label="সব" active={filter === "all"} onClick={() => handleFilterChange("all")} />
        <FilterTab
          label={`অপঠিত (${unreadCount})`}
          title="কাস্টমারের নতুন মেসেজ, যে কথোপকথন এখনো খোলা হয়নি"
          active={filter === "unread"}
          onClick={() => handleFilterChange("unread")}
        />
        <FilterTab
          label={`উত্তর বাকি (${awaitingCount})`}
          title="কাস্টমারের মেসেজই শেষ মেসেজ, এখনো রিপ্লাই যায়নি"
          active={filter === "awaiting"}
          onClick={() => handleFilterChange("awaiting")}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="কোনো কথোপকথন নেই" />
          </div>
        )}

        {paged.map((c) => {
          const page = Array.isArray(c.messenger_pages) ? c.messenger_pages[0] : c.messenger_pages;
          const isUnread = unreadSet.has(c.id);
          const isAwaiting = awaitingSet.has(c.id);
          const isActive = pathname === `/dashboard/messenger/inbox/${c.id}`;

          return (
            <Link
              key={c.id}
              href={`/dashboard/messenger/inbox/${c.id}`}
              className={`block border-b border-border px-3 py-3 last:border-b-0 ${isActive ? "bg-primary-light" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex min-w-0 items-center gap-1.5 text-sm ${isUnread ? "font-semibold text-text" : "font-medium text-text"}`}>
                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="অপঠিত" />}
                  <span className="truncate">{c.customer_name || c.psid}</span>
                </p>
                {isAwaiting && <Badge variant="warning" className="shrink-0">উত্তর বাকি</Badge>}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-text-muted">{page?.page_name}</span>
                <span className="shrink-0 text-xs text-text-muted">{formatDhakaDateTime(c.last_message_at)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 border-t border-border p-2">
          <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

function FilterTab({ label, title, active, onClick }: { label: string; title?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
        active ? "bg-primary-light text-primary" : "text-text-muted hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
