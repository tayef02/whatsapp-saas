"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Button, EmptyState } from "@/components/ui";
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

  async function handleApprove(p: Payment) {
    if (!confirm(`"${singleName(p.workspaces)}" এর ৳${p.amount_bdt} পেমেন্ট অনুমোদন করবেন? প্ল্যান সাথে সাথে চালু হয়ে যাবে।`)) return;
    setBusyId(p.id);
    const result = await approvePayment(p.id);
    setBusyId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function handleReject(p: Payment) {
    const reason = prompt("বাতিলের কারণ (ঐচ্ছিক):");
    if (reason === null) return; // ইউজার prompt বাতিল করেছে
    setBusyId(p.id);
    const result = await rejectPayment(p.id, reason);
    setBusyId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">পেন্ডিং পেমেন্ট ({payments.length})</h1>

      {payments.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title="কোনো পেন্ডিং পেমেন্ট নেই" description="নতুন পেমেন্ট জমা পড়লে এখানে দেখা যাবে।" />
      ) : (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>ইউজার</TableHeaderCell>
              <TableHeaderCell>প্ল্যান</TableHeaderCell>
              <TableHeaderCell>পরিমাণ</TableHeaderCell>
              <TableHeaderCell>Transaction ID</TableHeaderCell>
              <TableHeaderCell>তারিখ</TableHeaderCell>
              <TableHeaderCell>অ্যাকশন</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-text">{singleName(p.workspaces)}</TableCell>
                <TableCell>{singleName(p.plans)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  ৳{p.amount_bdt} <span className="text-text-muted capitalize">({p.provider})</span>
                  <div className="text-xs text-text-muted">পাঠানো নাম্বার: {p.sender_phone}</div>
                </TableCell>
                <TableCell className="text-text-muted">{p.transaction_id}</TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDateTime(p.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Button disabled={busyId === p.id} onClick={() => handleApprove(p)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> অনুমোদন
                    </Button>
                    <Button variant="danger" disabled={busyId === p.id} onClick={() => handleReject(p)}>
                      <XCircle className="h-3.5 w-3.5" /> বাতিল
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
