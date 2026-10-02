"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Card, Badge, EmptyState, Pagination } from "@/components/ui";
import { Inbox as InboxIcon } from "lucide-react";
import { formatDhakaDateTime } from "@/lib/format-date";

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  last_read_at?: string | null;
  contacts: { name: string | null; phone: string } | { name: string | null; phone: string }[] | null;
  whatsapp_numbers: { display_name: string | null } | { display_name: string | null }[] | null;
};

type Filter = "all" | "unread" | "awaiting" | "needs_human";

// conversations এই পুরো layout.tsx (inbox/layout.tsx) এ একবারে .limit(100) দিয়ে ফেচ হয়ে এখানে
// prop হিসেবে আসে (conversation select করলে পুরো সাইডবার আবার ফেচ হয় না) — তাই URL ?page= এর
// বদলে এখানে ক্লায়েন্ট-সাইড পেজিনেশন, একই কারণে ফিল্টার ট্যাবও আগে থেকেই ক্লায়েন্ট-সাইড ছিল
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

  const needsHumanCount = conversations.filter((c) => c.status === "handed_off").length;
  const unreadCount = conversations.filter((c) => unreadSet.has(c.id)).length;
  const awaitingCount = conversations.filter((c) => awaitingSet.has(c.id)).length;

  const filtered = conversations.filter((c) => {
    if (filter === "unread") return unreadSet.has(c.id);
    if (filter === "awaiting") return awaitingSet.has(c.id);
    if (filter === "needs_human") return c.status === "handed_off";
    return true;
  });

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
        <FilterTab label={`এজেন্ট (${needsHumanCount})`} active={filter === "needs_human"} onClick={() => handleFilterChange("needs_human")} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState icon={<InboxIcon className="h-8 w-8" />} title="কোনো কথোপকথন নেই" />
          </div>
        )}

        {paged.map((c) => {
          const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
          const number = Array.isArray(c.whatsapp_numbers) ? c.whatsapp_numbers[0] : c.whatsapp_numbers;
          const isUnread = unreadSet.has(c.id);
          const isAwaiting = awaitingSet.has(c.id);
          const isActive = pathname === `/dashboard/inbox/${c.id}`;

          return (
            <Link
              key={c.id}
              href={`/dashboard/inbox/${c.id}`}
              className={`block border-b border-border px-3 py-3 last:border-b-0 ${isActive ? "bg-primary-light" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex min-w-0 items-center gap-1.5 truncate text-sm ${isUnread ? "font-semibold text-text" : "font-medium text-text"}`}>
                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="অপঠিত" />}
                  <span className="truncate">{contact?.name || contact?.phone || "(অজানা)"}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {isAwaiting && <Badge variant="warning">উত্তর বাকি</Badge>}
                  {c.status === "handed_off" && <Badge variant="danger">এজেন্ট দরকার</Badge>}
                </div>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-text-muted">{number?.display_name}</span>
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
