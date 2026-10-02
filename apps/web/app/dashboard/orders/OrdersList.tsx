"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { ShoppingCart, Search, History } from "lucide-react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Badge,
  Select,
  EmptyState,
  Pagination,
} from "@/components/ui";
import { updateOrderStatus, getOrderHistory } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Order = {
  id: string;
  order_number: number;
  contact_phone: string;
  product_name: string | null;
  quantity: string | null;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  status: string;
  cancel_reason: string | null;
  raw_summary: string | null;
  created_at: string;
  channel: string;
  group_name: string | null;
  messenger_page_name: string | null;
};

type HistoryRow = { from_status: string | null; to_status: string; reason: string | null; created_at: string };

const statusLabel: Record<string, string> = {
  pending: "নতুন",
  confirmed: "কনফার্ম হয়েছে",
  shipped: "পাঠানো হয়েছে",
  cancelled: "বাতিল",
};

// ব্যাজ সরিয়ে এখন শুধু ড্রপডাউন — রং দিয়েই স্ট্যাটাস বোঝা যাবে (Badge এর variant ক্লাসের সাথে মিলিয়ে)
const statusSelectClass: Record<string, string> = {
  pending: "bg-warning-light text-warning",
  confirmed: "bg-info-light text-info",
  shipped: "bg-success-light text-success",
  cancelled: "bg-danger-light text-danger",
};

// Phase ১ (চ্যানেল বিচ্ছিন্নতা): এই কম্পোনেন্ট WhatsApp (/dashboard/orders) ও Messenger
// (/dashboard/messenger/orders) দুই পেজেই reuse হয় — প্রতিটা পেজ শুধু নিজের চ্যানেলের অর্ডার
// (orders.channel দিয়ে server-side ফিল্টার করা) পাস করে, তাই এখানে আর কোনো চ্যানেল-মেশানো
// সম্ভাবনা নেই — `channel` প্রপ শুধু খালি-স্টেট টেক্সট, URL বেস পাথ ও হেল্পার লেখার জন্য ব্যবহার হয়
//
// সার্চ/স্ট্যাটাস/পেজ — আগে ক্লায়েন্ট-সাইড useState+filter ছিল (২০০টা রো একসাথে এনে ব্রাউজারে
// ফিল্টার হতো), এখন সার্ভার-সাইড (page.tsx এ .range()+ilike/eq) — তাই এই কম্পোনেন্ট আর নিজে
// ফিল্টার করে না, শুধু q/status/page কে URL এ প্রতিফলিত করে (orders prop ইতিমধ্যে ফিল্টার-করা)
export default function OrdersList({
  orders,
  channel,
  page,
  totalPages,
  q,
  status,
}: {
  orders: Order[];
  channel: "whatsapp" | "messenger";
  page: number;
  totalPages: number;
  q: string;
  status: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyByOrder, setHistoryByOrder] = useState<Record<string, HistoryRow[]>>({});

  const basePath = channel === "whatsapp" ? "/dashboard/orders" : "/dashboard/messenger/orders";
  const hasFilters = Boolean(q || status);

  // Pagination কম্পোনেন্টের জন্য — "{page}" প্লেসহোল্ডার সহ টেমপ্লেট স্ট্রিং
  const paginationHrefTemplate = `${basePath}?page={page}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`;

  function handleStatusFilterChange(newStatus: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (newStatus) params.set("status", newStatus);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  async function handleStatusChange(order: Order, newStatus: string) {
    if (newStatus === order.status) return;

    let reason: string | undefined;
    if (newStatus === "cancelled") {
      const input = window.prompt("বাতিলের কারণ লিখুন (কাস্টমারকে এটা জানানো হবে):");
      if (input === null) return; // admin cancel করেছে prompt-টাই, status বদলাবে না
      reason = input.trim() || undefined;
    }

    setBusyId(order.id);
    const res = await updateOrderStatus(order.id, newStatus as "pending" | "confirmed" | "shipped" | "cancelled", reason);
    setBusyId(null);
    if (res.warning) window.alert(res.warning);
    router.refresh();
  }

  async function toggleHistory(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!historyByOrder[orderId]) {
      const rows = await getOrderHistory(orderId);
      setHistoryByOrder((prev) => ({ ...prev, [orderId]: rows }));
    }
  }

  if (orders.length === 0 && !hasFilters) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-10 w-10" />}
        title="এখনো কোনো অর্ডার আসেনি"
        description={
          channel === "whatsapp"
            ? 'AI চ্যাটবট কথোপকথনে বা গ্রুপে "ORDER: নাম, নাম্বার, প্রোডাক্ট" ফরম্যাটে মেসেজ এলে এখানে অটোমেটিক লিস্ট হবে।'
            : "Messenger AI চ্যাটবট কথোপকথনে অর্ডার কনফার্ম হলে এখানে অটোমেটিক লিস্ট হবে।"
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={basePath} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="অর্ডার নং, কাস্টমার, নাম্বার বা পণ্য দিয়ে খুঁজুন"
            className="w-full rounded-lg border border-border py-2 pr-3 pl-9 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <Select name="status" value={status} onChange={(e) => handleStatusFilterChange(e.target.value)} className="w-44">
          <option value="">সব স্ট্যাটাস</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <button type="submit" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50">
          খুঁজুন
        </button>
      </form>

      {orders.length === 0 ? (
        <EmptyState icon={<Search className="h-10 w-10" />} title="কোনো অর্ডার পাওয়া যায়নি" description="সার্চ/ফিল্টার বদলে আবার চেষ্টা করুন।" />
      ) : (
        <>
          <Table>
              <TableHead>
                <TableRow className="hover:bg-transparent">
                  <TableHeaderCell>অর্ডার নং</TableHeaderCell>
                  <TableHeaderCell>কাস্টমার</TableHeaderCell>
                  <TableHeaderCell>নাম্বার</TableHeaderCell>
                  <TableHeaderCell>পণ্য</TableHeaderCell>
                  <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
                  <TableHeaderCell>তারিখ</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((o) => (
                  <Fragment key={o.id}>
                    <TableRow>
                      <TableCell className="font-medium text-text">#{o.order_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{o.delivery_name || "(নাম নেই)"}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {o.contact_phone}
                        {o.channel === "messenger" && (
                          <Badge variant="info" className="ml-1.5">
                            Messenger{o.messenger_page_name ? ` · ${o.messenger_page_name}` : ""}
                          </Badge>
                        )}
                        {o.group_name && (
                          <Badge variant="info" className="ml-1.5">
                            {o.group_name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {o.product_name || <span className="text-text-muted">(পণ্যের নাম নেই)</span>}
                        {o.quantity && <span className="text-text-muted"> × {o.quantity}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <select
                            value={o.status}
                            disabled={busyId === o.id}
                            onChange={(e) => handleStatusChange(o, e.target.value)}
                            className={`rounded-lg border-0 px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 ${statusSelectClass[o.status] ?? "bg-gray-100 text-text-muted"}`}
                            aria-label="স্ট্যাটাস বদলান"
                          >
                            {Object.entries(statusLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        <div className="flex items-center gap-2">
                          {formatDhakaDateTime(o.created_at)}
                          <button
                            onClick={() => toggleHistory(o.id)}
                            className="flex h-10 w-10 items-center justify-center text-text-muted hover:text-primary"
                            aria-label="স্ট্যাটাস হিস্ট্রি"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {(o.delivery_address || (o.status === "cancelled" && o.cancel_reason) || (!o.product_name && o.raw_summary)) && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-app-bg py-2 text-xs text-text-muted">
                          {o.delivery_address && <p>ডেলিভারি ঠিকানা: {[o.delivery_name, o.delivery_phone, o.delivery_address].filter(Boolean).join(", ")}</p>}
                          {o.status === "cancelled" && o.cancel_reason && <p className="text-danger">বাতিলের কারণ: {o.cancel_reason}</p>}
                          {!o.product_name && o.raw_summary && <p className="text-warning">ডাটা পুরোপুরি পার্স করা যায়নি, আসল টেক্সট: {o.raw_summary}</p>}
                        </TableCell>
                      </TableRow>
                    )}

                    {expandedId === o.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-app-bg py-3 text-xs">
                          {!historyByOrder[o.id] && <p className="text-text-muted">লোড হচ্ছে...</p>}
                          {historyByOrder[o.id]?.length === 0 && <p className="text-text-muted">কোনো হিস্ট্রি নেই।</p>}
                          {historyByOrder[o.id]?.map((h, i) => (
                            <p key={i} className="text-text-muted">
                              {formatDhakaDateTime(h.created_at)} — {h.from_status ? `${statusLabel[h.from_status] ?? h.from_status} → ` : ""}
                              {statusLabel[h.to_status] ?? h.to_status}
                              {h.reason && ` (কারণ: ${h.reason})`}
                            </p>
                          ))}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
          </Table>

          <Pagination currentPage={page} totalPages={totalPages} hrefTemplate={paginationHrefTemplate} />
        </>
      )}
    </div>
  );
}
