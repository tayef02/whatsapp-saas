"use client";

import { useState } from "react";
import { approvePayment, rejectPayment } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Payment = {
  id: string;
  amount_bdt: number;
  provider: string;
  sender_phone: string;
  transaction_id: string;
  created_at: string;
  workspaces: { name: string } | { name: string }[] | null;
  plans: { name: string } | { name: string }[] | null;
};

function singleName(v: Payment["workspaces"]): string {
  const item = Array.isArray(v) ? v[0] : v;
  return item?.name ?? "";
}

export default function PendingPaymentsList({ payments: initial }: { payments: Payment[] }) {
  const [payments, setPayments] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approvePayment(id);
    setBusyId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    setPayments((p) => p.filter((x) => x.id !== id));
  }

  async function handleReject(id: string) {
    const reason = prompt("বাতিলের কারণ (ঐচ্ছিক):") ?? "";
    setBusyId(id);
    const result = await rejectPayment(id, reason);
    setBusyId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    setPayments((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div>
      <h1>পেন্ডিং পেমেন্ট ({payments.length})</h1>

      {payments.length === 0 && <p>কোনো পেন্ডিং পেমেন্ট নেই।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {payments.map((p) => (
          <div key={p.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{singleName(p.workspaces)}</strong>
              <span style={{ fontSize: 12, color: "#666" }}>{formatDhakaDateTime(p.created_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: "#333" }}>
              প্ল্যান: {singleName(p.plans)} · ৳{p.amount_bdt} · {p.provider}
              <br />
              পাঠানো নাম্বার: {p.sender_phone}
              <br />
              Transaction ID: <strong>{p.transaction_id}</strong>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button disabled={busyId === p.id} onClick={() => handleApprove(p.id)}>
                Approve
              </button>
              <button
                disabled={busyId === p.id}
                onClick={() => handleReject(p.id)}
                style={{ background: "white", color: "#dc2626", border: "1px solid #dc2626" }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
