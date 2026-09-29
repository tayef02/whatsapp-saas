"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Inbox as InboxIcon } from "lucide-react";
import { formatDhakaDateTime } from "@/lib/format-date";

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  contacts: { name: string | null; phone: string } | { name: string | null; phone: string }[] | null;
  whatsapp_numbers: { display_name: string | null } | { display_name: string | null }[] | null;
};

type Filter = "all" | "unread" | "needs_human";

export default function ConversationList({ conversations, unreadIds }: { conversations: Conversation[]; unreadIds: string[] }) {
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");
  const unreadSet = new Set(unreadIds);

  const needsHumanCount = conversations.filter((c) => c.status === "handed_off").length;
  const unreadCount = conversations.filter((c) => unreadSet.has(c.id)).length;

  const filtered = conversations.filter((c) => {
    if (filter === "unread") return unreadSet.has(c.id);
    if (filter === "needs_human") return c.status === "handed_off";
    return true;
  });

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2">
        <FilterTab label="সব" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label={`উত্তর বাকি (${unreadCount})`} active={filter === "unread"} onClick={() => setFilter("unread")} />
        <FilterTab label={`এজেন্ট (${needsHumanCount})`} active={filter === "needs_human"} onClick={() => setFilter("needs_human")} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState icon={<InboxIcon className="h-8 w-8" />} title="কোনো কথোপকথন নেই" />
          </div>
        )}

        {filtered.map((c) => {
          const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
          const number = Array.isArray(c.whatsapp_numbers) ? c.whatsapp_numbers[0] : c.whatsapp_numbers;
          const isUnread = unreadSet.has(c.id);
          const isActive = pathname === `/dashboard/inbox/${c.id}`;

          return (
            <Link
              key={c.id}
              href={`/dashboard/inbox/${c.id}`}
              className={`block border-b border-border px-3 py-3 last:border-b-0 ${isActive ? "bg-primary-light" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`min-w-0 truncate text-sm ${isUnread ? "font-semibold text-text" : "font-medium text-text"}`}>
                  {contact?.name || contact?.phone || "(অজানা)"}
                </p>
                {c.status === "handed_off" && (
                  <Badge variant="danger" className="shrink-0">
                    এজেন্ট দরকার
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-text-muted">{number?.display_name}</span>
                <span className="shrink-0 text-xs text-text-muted">{formatDhakaDateTime(c.last_message_at)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
        active ? "bg-primary-light text-primary" : "text-text-muted hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
