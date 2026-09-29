"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Card, Input, Select, Button, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from "@/components/ui";
import { submitPayment } from "./actions";
import { formatDhakaDate } from "@/lib/format-date";

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

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const subscriptionStatusLabel: Record<string, string> = {
  active: "সক্রিয়",
  trial: "ট্রায়াল",
  expired: "মেয়াদ শেষ",
};

const subscriptionStatusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "success",
  trial: "info",
  expired: "danger",
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

  const monthlyLimit = currentSubscription?.plans?.monthly_message_limit ?? 0;
  const usedThisCycle = currentSubscription?.messages_used_this_cycle ?? 0;
  const rawUsagePct = monthlyLimit > 0 ? (usedThisCycle / monthlyLimit) * 100 : 0;
  const usagePct = Math.min(100, Math.round(rawUsagePct));
  const usagePctLabel = usedThisCycle > 0 && rawUsagePct < 1 ? "<১%" : `${usagePct}%`;
  const usageBarWidthPct = usedThisCycle > 0 ? Math.max(rawUsagePct, 1) : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-text">প্ল্যান ও বিলিং</h1>

      {currentSubscription && (
        <Card className="max-w-md">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">বর্তমান প্ল্যান: {currentSubscription.plans?.name ?? "নেই"}</p>
            <Badge variant={subscriptionStatusVariant[currentSubscription.subscription_status] ?? "neutral"}>
              {subscriptionStatusLabel[currentSubscription.subscription_status] ?? currentSubscription.subscription_status}
            </Badge>
          </div>
          {currentSubscription.subscription_expires_at && (
            <p className="mb-3 text-xs text-text-muted">মেয়াদ শেষ: {formatDhakaDate(currentSubscription.subscription_expires_at)}</p>
          )}
          {currentSubscription.plans && (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
                <span>এই সাইকেলে ব্যবহার</span>
                <span>
                  {usedThisCycle} / {monthlyLimit} মেসেজ
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${usagePct >= 90 ? "bg-danger" : usagePct >= 70 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${usageBarWidthPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-text-muted">{usagePctLabel} ব্যবহার হয়েছে</p>
            </>
          )}
        </Card>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-text">প্ল্যান তুলনা</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans
            .filter((p) => !p.is_trial)
            .map((plan) => {
              const isCurrent = plan.name === currentSubscription?.plans?.name;
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <Card
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setDone(false);
                  }}
                  className={`cursor-pointer ${isSelected ? "border-primary ring-1 ring-primary" : isCurrent ? "border-primary-light" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-semibold text-text">{plan.name}</p>
                    {isCurrent && <Badge variant="success">বর্তমান</Badge>}
                  </div>
                  <p className="my-2 text-xl font-bold text-text">৳{plan.price_bdt}</p>
                  <ul className="flex flex-col gap-1 text-xs text-text-muted">
                    <li>{plan.monthly_message_limit} মেসেজ/মাস</li>
                    <li>{plan.contact_limit} কন্টাক্ট</li>
                    <li>{plan.max_numbers} নাম্বার পর্যন্ত</li>
                    <li>{plan.duration_days} দিন মেয়াদ</li>
                  </ul>
                </Card>
              );
            })}
        </div>
      </div>

      {selectedPlan && !done && (
        <Card className="max-w-md">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text">
              {selectedPlan.name} — ৳{selectedPlan.price_bdt}
            </p>
          </div>

          <div className="mb-4 rounded-lg bg-app-bg p-3 text-sm">
            <p className="mb-1 text-text">
              bKash (Send Money): <strong>{bkashNumber || "সেট করা হয়নি"}</strong>
            </p>
            <p className="text-text">
              Nagad (Send Money): <strong>{nagadNumber || "সেট করা হয়নি"}</strong>
            </p>
            <p className="mt-2 text-xs text-text-muted">উপরের নাম্বারে ৳{selectedPlan.price_bdt} Send Money করে নিচে Transaction ID দিন।</p>
          </div>

          {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

          <form action={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="planId" value={selectedPlan.id} />
            <input type="hidden" name="amountBdt" value={selectedPlan.price_bdt} />

            <Select name="provider" label="কোথা থেকে পাঠিয়েছেন" required>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
            </Select>

            <Input name="senderPhone" label="আপনার নাম্বার (যেখান থেকে পাঠিয়েছেন)" required placeholder="01712345678" />
            <Input name="transactionId" label="Transaction ID" required />

            <Button type="submit" loading={loading}>
              {loading ? "জমা হচ্ছে..." : "জমা দিন"}
            </Button>
          </form>
        </Card>
      )}

      {done && (
        <p className="flex max-w-md items-center gap-2 rounded-lg bg-success-light px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> পেমেন্ট জমা হয়েছে। যাচাই করে প্ল্যান চালু হলে জানানো হবে (ইন-অ্যাপ নোটিফিকেশন)।
        </p>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-text">পেমেন্ট হিস্ট্রি</p>
        {payments.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-10 w-10" />} title="কোনো পেমেন্ট নেই" />
        ) : (
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>প্ল্যান</TableHeaderCell>
                <TableHeaderCell>পরিমাণ</TableHeaderCell>
                <TableHeaderCell>মাধ্যম</TableHeaderCell>
                <TableHeaderCell>Transaction ID</TableHeaderCell>
                <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
                <TableHeaderCell>তারিখ</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-text">{planName(p.plans)}</TableCell>
                  <TableCell>৳{p.amount_bdt}</TableCell>
                  <TableCell className="capitalize">{p.provider}</TableCell>
                  <TableCell className="text-text-muted">{p.transaction_id}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status] ?? "neutral"}>{statusLabel[p.status] ?? p.status}</Badge>
                    {p.status === "rejected" && p.rejection_reason && <p className="mt-1 text-xs text-danger">কারণ: {p.rejection_reason}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDate(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
