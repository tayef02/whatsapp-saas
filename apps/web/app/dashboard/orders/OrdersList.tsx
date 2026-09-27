"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrderStatus } from "./actions";

type Order = {
  id: string;
  contact_phone: string;
  product_name: string | null;
  quantity: string | null;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  status: string;
  raw_summary: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  pending: "🟡 নতুন",
  confirmed: "✅ কনফার্ম হয়েছে",
  shipped: "🚚 পাঠানো হয়েছে",
  cancelled: "❌ বাতিল",
};

export default function OrdersList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleStatusChange(orderId: string, status: string) {
    setBusyId(orderId);
    await updateOrderStatus(orderId, status as "pending" | "confirmed" | "shipped" | "cancelled");
    setBusyId(null);
    router.refresh();
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
              <strong>{o.product_name || "(পণ্যের নাম নেই)"}</strong>
              {o.quantity && <span style={{ color: "#666" }}> × {o.quantity}</span>}
              <div style={{ color: "#666", marginTop: 4 }}>কাস্টমার: {o.contact_phone}</div>
              {(o.delivery_name || o.delivery_phone || o.delivery_address) && (
                <div style={{ color: "#666", marginTop: 2 }}>
                  ডেলিভারি: {[o.delivery_name, o.delivery_phone, o.delivery_address].filter(Boolean).join(", ")}
                </div>
              )}
              {!o.product_name && o.raw_summary && (
                <div style={{ color: "#b45309", marginTop: 4, fontSize: 12 }}>
                  ⚠️ AI এর ডাটা পার্স করা যায়নি, আসল টেক্সট: {o.raw_summary}
                </div>
              )}
              <div style={{ color: "#999", marginTop: 4, fontSize: 11 }}>{new Date(o.created_at).toLocaleString("bn-BD")}</div>
            </div>
            <select
              value={o.status}
              disabled={busyId === o.id}
              onChange={(e) => handleStatusChange(o.id, e.target.value)}
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
