"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Badge, Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, useToast } from "@/components/ui";
import { addPlatformDomain, verifyPlatformDomain } from "./actions";

interface DnsRow {
  record: string;
  type: string;
  name: string;
  value: string;
  priority: number | null;
  status: string;
}

export interface DomainView {
  id: string;
  domain: string;
  status: string;
  spf_status: string;
  dkim_status: string;
  dmarc_status: string;
  dmarc_policy: string | null;
  dns_records: DnsRow[];
  verified_at: string | null; // আগে থেকে Asia/Dhaka ফরম্যাটে সার্ভারে সাজানো
  last_checked_at: string | null;
  last_error: string | null;
}

const statusVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  present: "success",
  pending: "warning",
  failed: "danger",
  suspended: "danger",
  missing: "danger",
  invalid: "danger",
};

const statusLabel: Record<string, string> = {
  verified: "যাচাইকৃত",
  present: "আছে",
  pending: "অপেক্ষায়",
  failed: "ব্যর্থ",
  suspended: "স্থগিত",
  missing: "নেই",
  invalid: "ভুল",
};

function StatusBadge({ value }: { value: string }) {
  return <Badge variant={statusVariant[value] ?? "neutral"}>{statusLabel[value] ?? value}</Badge>;
}

// প্ল্যাটফর্ম ডোমেইন যোগ ও যাচাই। dmarcRecord সার্ভার থেকে স্ট্রিং হিসেবে আসে (ফাংশন প্রপ না)
export default function DomainManager({ domain, dmarcName }: { domain: DomainView | null; dmarcName: string | null }) {
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleAdd(formData: FormData) {
    setAdding(true);
    const result = await addPlatformDomain(formData);
    setAdding(false);
    if (result.error) showToast("error", result.error);
    else showToast("success", "ডোমেইন যোগ হয়েছে — নিচের DNS রেকর্ডগুলো বসান");
  }

  async function handleVerify() {
    if (!domain) return;
    setVerifying(true);
    const result = await verifyPlatformDomain(domain.id);
    setVerifying(false);
    if (result.error) showToast("error", result.error);
    else if (result.status === "verified") showToast("success", "ডোমেইন যাচাই হয়েছে");
    else showToast("error", "এখনো সব রেকর্ড যাচাই হয়নি — DNS ছড়াতে কিছুক্ষণ লাগে, একটু পর আবার চাপুন");
  }

  if (!domain) {
    return (
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-text-muted" />
          <p className="text-sm font-semibold text-text">প্ল্যাটফর্ম ইমেইল ডোমেইন</p>
        </div>
        <p className="mb-3 text-sm text-text-muted">
          সব ওয়ার্কস্পেস এই ডোমেইন থেকে ইমেইল পাঠাবে। মূল ডোমেইনের সুনাম আলাদা রাখতে সাবডোমেইন ব্যবহার করুন (যেমন mail.yourdomain.com)।
        </p>
        <form action={handleAdd} className="flex max-w-md flex-col gap-3">
          <Input name="domain" label="ডোমেইন" placeholder="mail.yourdomain.com" required />
          <Input name="fromLocal" label="From ঠিকানার অংশ" defaultValue="hello" helperText="hello দিলে ঠিকানা হবে hello@<ডোমেইন>" />
          <Button type="submit" loading={adding} className="self-start">
            ডোমেইন যোগ করুন
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-text-muted" />
          <p className="text-sm font-semibold text-text">{domain.domain}</p>
          <StatusBadge value={domain.status} />
        </div>
        <Button onClick={handleVerify} loading={verifying}>
          যাচাই করুন
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          SPF <StatusBadge value={domain.spf_status} />
        </span>
        <span className="flex items-center gap-1.5">
          DKIM <StatusBadge value={domain.dkim_status} />
        </span>
        <span className="flex items-center gap-1.5">
          DMARC <StatusBadge value={domain.dmarc_status} />
          {domain.dmarc_policy && <span className="text-xs text-text-muted">(p={domain.dmarc_policy})</span>}
        </span>
      </div>

      {domain.status === "failed" && (
        <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
          ডোমেইন যাচাই ব্যর্থ — যতক্ষণ না আবার যাচাই হয়, কোনো ইমেইল পাঠানো হবে না।
        </p>
      )}
      {domain.last_error && <p className="mb-3 text-xs text-warning">সর্বশেষ চেকে সমস্যা: {domain.last_error}</p>}

      <p className="mb-2 text-sm font-medium text-text">DNS-এ বসানোর রেকর্ড</p>
      <div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>ধরন</TableHeaderCell>
              <TableHeaderCell>নাম</TableHeaderCell>
              <TableHeaderCell>মান</TableHeaderCell>
              <TableHeaderCell>অবস্থা</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {domain.dns_records.map((r, i) => (
              <TableRow key={`${r.record}-${r.type}-${i}`}>
                <TableCell>
                  {r.record} · {r.type}
                  {r.priority !== null ? ` (priority ${r.priority})` : ""}
                </TableCell>
                <TableCell className="font-mono text-xs break-all">{r.name}</TableCell>
                <TableCell className="font-mono text-xs break-all">{r.value}</TableCell>
                <TableCell>
                  <StatusBadge value={r.status === "not_started" ? "pending" : r.status} />
                </TableCell>
              </TableRow>
            ))}
            {dmarcName && (
              <TableRow>
                <TableCell>DMARC · TXT</TableCell>
                <TableCell className="font-mono text-xs break-all">{dmarcName}</TableCell>
                <TableCell className="font-mono text-xs break-all">v=DMARC1; p=none;</TableCell>
                <TableCell>
                  <StatusBadge value={domain.dmarc_status} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        DMARC যাচাই বাধ্যতামূলক (p=none চলবে)। উপরের ডোমেইনে (parent) আগে থেকে DMARC থাকলে সেটাও গ্রহণযোগ্য।
      </p>
      <p className="mt-1 text-xs text-text-muted">
        সর্বশেষ চেক: {domain.last_checked_at ?? "—"} · প্রথম যাচাই (warm-up শুরু): {domain.verified_at ?? "এখনো হয়নি"}
      </p>
    </Card>
  );
}
