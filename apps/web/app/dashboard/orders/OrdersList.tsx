"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  group_name: string | null;
};

type HistoryRow = { from_status: string | null; to_status: string; reason: string | null; created_at: string };

const statusLabel: Record<string, string> = {
  pending: "🟡 নতুন",
  confirmed: "✅ কনফার্ম হয়েছে",
  shipped: "🚚 পাঠানো হয়েছে",
  cancelled: "❌ বাতিল",
};

export default function OrdersList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyByOrder, setHistoryByOrder] = useState<Record<string, HistoryRow[]>>({});

  async function handleStatusChange(order: Order, status: string) {
    if (status === order.status) return;

    let reason: string | undefined;
    if (status === "cancelled") {
      const input = window.prompt("বাতিলের কারণ লিখুন (কাস্টমারকে এটা জানানো হবে):");
      if (input === null) return; // admin cancel করেছে prompt-টাই, status বদলাবে না
      reason = input.trim() || undefined;
    }

    setBusyId(order.id);
    const res = await updateOrderStatus(order.id, status as "pending" | "confirmed" | "shipped" | "cancelled", reason);
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

  if (orders.length === 0) return <p>এখনো কোনো অর্ডার আসেনি।</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            background: "white",
            border: o.status === "pending" ? "1px solid #fde68a" : "1px solid #eee",
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <strong>#{o.order_number}</strong> <strong>{o.product_name || "(পণ্যের নাম নেই)"}</strong>
              {o.quantity && <span style={{ color: "#666" }}> × {o.quantity}</span>}
              <div style={{ color: "#666", marginTop: 4 }}>
                কাস্টমার: {o.contact_phone}
                {o.group_name && ` — 👥 গ্রুপ: ${o.group_name}`}
              </div>
              {(o.delivery_name || o.delivery_phone || o.delivery_address) && (
                <div style={{ color: "#666", marginTop: 2 }}>
                  ডেলিভারি: {[o.delivery_name, o.delivery_phone, o.delivery_address].filter(Boolean).join(", ")}
                </div>
              )}
              {o.status === "cancelled" && o.cancel_reason && (
                <div style={{ color: "#dc2626", marginTop: 2, fontSize: 12 }}>বাতিলের কারণ: {o.cancel_reason}</div>
              )}
              {!o.product_name && o.raw_summary && (
                <div style={{ color: "#b45309", marginTop: 4, fontSize: 12 }}>
                  ⚠️ ডাটা পুরোপুরি পার্স করা যায়নি, আসল টেক্সট: {o.raw_summary}
                </div>
              )}
              <div style={{ color: "#999", marginTop: 4, fontSize: 11 }}>{formatDhakaDateTime(o.created_at)}</div>
              <button
                onClick={() => toggleHistory(o.id)}
                style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0, marginTop: 6 }}
              >
                {expandedId === o.id ? "হিস্ট্রি লুকান" : "স্ট্যাটাস হিস্ট্রি দেখুন"}
              </button>
              {expandedId === o.id && (
                <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: 8, fontSize: 11 }}>
                  {!historyByOrder[o.id] && <p>লোড হচ্ছে...</p>}
                  {historyByOrder[o.id]?.length === 0 && <p>কোনো হিস্ট্রি নেই।</p>}
                  {historyByOrder[o.id]?.map((h, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      {formatDhakaDateTime(h.created_at)} — {h.from_status ? `${statusLabel[h.from_status] ?? h.from_status} → ` : ""}
                      {statusLabel[h.to_status] ?? h.to_status}
                      {h.reason && ` (কারণ: ${h.reason})`}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select
              value={o.status}
              disabled={busyId === o.id}
              onChange={(e) => handleStatusChange(o, e.target.value)}
              style={{ width: "auto", flexShrink: 0 }}
            >
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
