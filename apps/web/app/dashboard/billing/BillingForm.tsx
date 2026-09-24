"use client";

import { useState } from "react";
import { submitPayment } from "./actions";

type Plan = {
  id: string;
  name: string;
  price_bdt: number;
  monthly_message_limit: number;
  contact_limit: number;
  max_numbers: number;
  duration_days: number;
  is_trial: boolean;
};

type Payment = {
  id: string;
  provider: string;
  amount_bdt: number;
  transaction_id: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  plans: { name: string } | { name: string }[] | null;
};

interface Props {
  plans: Plan[];
  currentSubscription: {
    subscription_status: string;
    subscription_expires_at: string | null;
    messages_used_this_cycle: number;
    plans: { name: string; monthly_message_limit: number } | null;
  } | null;
  payments: Payment[];
  bkashNumber: string;
  nagadNumber: string;
}

const statusLabel: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  approved: "অনুমোদিত",
  rejected: "বাতিল",
};

function planName(p: Payment["plans"]): string {
  const plan = Array.isArray(p) ? p[0] : p;
  return plan?.name ?? "";
}

export default function BillingForm({ plans, currentSubscription, payments, bkashNumber, nagadNumber }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await submitPayment(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setSelectedPlan(null);
  }

  return (
    <div>
      <h1>প্ল্যান ও বিলিং</h1>

      {currentSubscription && (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <strong>বর্তমান প্ল্যান: {currentSubscription.plans?.name ?? "নেই"}</strong>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            স্ট্যাটাস: {currentSubscription.subscription_status === "active" ? "সক্রিয়" : currentSubscription.subscription_status === "trial" ? "ট্রায়াল" : "মেয়াদ শেষ"}
            {currentSubscription.subscription_expires_at &&
              ` · মেয়াদ শেষ: ${new Date(currentSubscription.subscription_expires_at).toLocaleDateString("bn-BD")}`}
          </div>
          {currentSubscription.plans && (
            <div style={{ fontSize: 13, color: "#666" }}>
              এই সাইকেলে ব্যবহার: {currentSubscription.messages_used_this_cycle} / {currentSubscription.plans.monthly_message_limit} মেসেজ
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {plans
          .filter((p) => !p.is_trial)
          .map((plan) => (
            <div
              key={plan.id}
              onClick={() => {
                setSelectedPlan(plan);
                setDone(false);
              }}
              style={{
                background: "white",
                border: selectedPlan?.id === plan.id ? "2px solid #16a34a" : "1px solid #eee",
                borderRadius: 8,
                padding: 16,
                cursor: "pointer",
              }}
            >
              <strong>{plan.name}</strong>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>৳{plan.price_bdt}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {plan.monthly_message_limit} মেসেজ/মাস
                <br />
                {plan.contact_limit} কন্টাক্ট
                <br />
                {plan.max_numbers} নাম্বার পর্যন্ত
              </div>
            </div>
          ))}
      </div>

      {selectedPlan && !done && (
        <div className="auth-card" style={{ margin: "0 auto 24px" }}>
          <h2 style={{ fontSize: 16 }}>{selectedPlan.name} — ৳{selectedPlan.price_bdt}</h2>
          <p style={{ fontSize: 13, color: "#666" }}>
            bKash (Send Money): <strong>{bkashNumber || "সেট করা হয়নি"}</strong>
            <br />
            Nagad (Send Money): <strong>{nagadNumber || "সেট করা হয়নি"}</strong>
          </p>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            উপরের নাম্বারে ৳{selectedPlan.price_bdt} Send Money করে নিচে Transaction ID দিন।
          </p>
          {error && <div className="error">{error}</div>}
          <form action={handleSubmit}>
            <input type="hidden" name="planId" value={selectedPlan.id} />
            <input type="hidden" name="amountBdt" value={selectedPlan.price_bdt} />

            <label htmlFor="provider">কোথা থেকে পাঠিয়েছেন</label>
            <select id="provider" name="provider" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
            </select>

            <label htmlFor="senderPhone">আপনার নাম্বার (যেখান থেকে পাঠিয়েছেন)</label>
            <input id="senderPhone" name="senderPhone" type="text" required placeholder="01712345678" />

            <label htmlFor="transactionId">Transaction ID</label>
            <input id="transactionId" name="transactionId" type="text" required />

            <button type="submit" disabled={loading}>
              {loading ? "জমা হচ্ছে..." : "জমা দিন"}
            </button>
          </form>
        </div>
      )}

      {done && (
        <div style={{ background: "#dcfce7", padding: 16, borderRadius: 8, marginBottom: 24 }}>
          পেমেন্ট জমা হয়েছে। যাচাই করে প্ল্যান চালু হলে জানানো হবে (ইন-অ্যাপ নোটিফিকেশন)।
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>পেমেন্ট হিস্ট্রি</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {payments.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>কোনো পেমেন্ট নেই।</p>}
        {payments.map((p) => (
          <div key={p.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 12, fontSize: 13 }}>
            {planName(p.plans)} · ৳{p.amount_bdt} · {p.provider} · {p.transaction_id} ·{" "}
            <strong
              style={{
                color: p.status === "approved" ? "#166534" : p.status === "rejected" ? "#dc2626" : "#b45309",
              }}
            >
              {statusLabel[p.status]}
            </strong>
            {p.status === "rejected" && p.rejection_reason && (
              <div style={{ color: "#dc2626", marginTop: 4 }}>কারণ: {p.rejection_reason}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
