"use client";

import { useEffect, useState } from "react";
import { Info, PauseCircle, PlayCircle, XCircle, RotateCcw } from "lucide-react";
import { Card, Badge, Button, Pagination } from "@/components/ui";
import { pauseCampaign, resumeCampaign, cancelCampaign, retryFailedMessages } from "./actions";

type Stats = {
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  unknown_count: number;
};

type FailedMessage = {
  id: string;
  phone: string;
  failed_reason: string | null;
  retry_count: number;
  contacts: { name: string | null } | { name: string | null }[] | null;
};

type CampaignData = {
  id: string;
  status: string;
  paused_reason: string | null;
  campaign_stats: Stats | Stats[] | null;
  failedMessages?: FailedMessage[];
};

function contactName(c: FailedMessage["contacts"]): string {
  const contact = Array.isArray(c) ? c[0] : c;
  return contact?.name ?? "(নাম নেই)";
}

const statusLabel: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "শিডিউল হয়েছে",
  sending: "পাঠানো হচ্ছে",
  paused: "পজ করা",
  cancelled: "বাতিল",
  completed: "শেষ হয়েছে",
  failed: "ব্যর্থ",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  sending: "success",
  scheduled: "info",
  paused: "warning",
  cancelled: "neutral",
  completed: "info",
  failed: "danger",
  draft: "neutral",
};

const pausedReasonLabel: Record<string, string> = {
  manual: "আপনি নিজে পজ করেছেন",
  number_disconnected: "নাম্বার ডিসকানেক্ট/ব্যান হয়েছিল",
  high_failure_rate: "ব্যর্থতার হার বেশি ছিল",
};

function normalizeStats(s: Stats | Stats[] | null): Stats {
  const stats = Array.isArray(s) ? s[0] : s;
  return stats ?? { total_recipients: 0, sent_count: 0, delivered_count: 0, read_count: 0, failed_count: 0, unknown_count: 0 };
}

// ব্যর্থ মেসেজের তালিকা সার্ভারে (page.tsx ও এর লাইভ-পোলিং /api/campaigns/[id] রুট, দুই জায়গাতেই)
// সবসময় সর্বশেষ ১০০টা পর্যন্ত আনে — এই কম্পোনেন্ট প্রতি ৩ সেকেন্ডে পোল করে সেটাই রিফ্রেশ করে।
// তাই true সার্ভার-সাইড range পেজিনেশন (URL ?page=) এখানে বসালে পোলিং রুটেও আলাদা page প্যারাম
// প্লাম্বিং লাগত — তার বদলে ইতিমধ্যে আনা (সর্বোচ্চ ১০০টা) তালিকার উপর ক্লায়েন্ট-সাইড পেজিনেশন
const FAILED_PAGE_SIZE = 10;

export default function CampaignReport({ initial, stallNote }: { initial: CampaignData; stallNote: string | null }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failedPage, setFailedPage] = useState(1);

  useEffect(() => {
    if (data.status === "completed" || data.status === "cancelled") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/campaigns/${data.id}`);
      if (res.ok) setData(await res.json());
    }, 3000);

    return () => clearInterval(interval);
  }, [data.status, data.id]);

  const stats = normalizeStats(data.campaign_stats);

  async function run(fn: (id: string) => Promise<{ error: string | null }>) {
    setBusy(true);
    await fn(data.id);
    setBusy(false);
    const res = await fetch(`/api/campaigns/${data.id}`);
    if (res.ok) setData(await res.json());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">ক্যাম্পেইন রিপোর্ট</h1>
        <Badge variant={statusVariant[data.status] ?? "neutral"}>{statusLabel[data.status] ?? data.status}</Badge>
      </div>

      {data.paused_reason && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
          <PauseCircle className="h-4 w-4 shrink-0" /> পজ হওয়ার কারণ: {pausedReasonLabel[data.paused_reason] ?? data.paused_reason}
        </p>
      )}

      {data.status === "sending" && stallNote && (
        <p className="flex items-center gap-2 rounded-lg bg-info-light px-3 py-2 text-sm text-info">
          <Info className="h-4 w-4 shrink-0" /> {stallNote}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="মোট" value={stats.total_recipients} />
        <StatBox label="পাঠানো হয়েছে" value={stats.sent_count} />
        {/* "পড়া হয়েছে" মানে ডেলিভার্ডও হয়েছে। delivered_count/read_count আলাদা ইভেন্ট কাউন্টার —
            যোগ করলে ডাবল-কাউন্ট হয়ে যায়, তাই "কমপক্ষে ডেলিভার্ড" বোঝাতে max() ব্যবহার করা হচ্ছে */}
        <StatBox label="ডেলিভার্ড" value={Math.max(stats.delivered_count, stats.read_count)} />
        <StatBox label="পড়া হয়েছে" value={stats.read_count} />
        <StatBox label="ব্যর্থ" value={stats.failed_count} variant="danger" />
        <StatBox label="অজানা" value={stats.unknown_count} variant="warning" />
      </div>

      <div className="flex flex-wrap gap-2">
        {data.status === "sending" && (
          <Button variant="secondary" disabled={busy} onClick={() => run(pauseCampaign)}>
            <PauseCircle className="h-4 w-4" /> পজ করুন
          </Button>
        )}
        {data.status === "paused" && (
          <Button variant="secondary" disabled={busy} onClick={() => run(resumeCampaign)}>
            <PlayCircle className="h-4 w-4" /> আবার চালু করুন
          </Button>
        )}
        {["draft", "scheduled", "sending", "paused"].includes(data.status) && (
          <Button variant="danger" disabled={busy} onClick={() => run(cancelCampaign)}>
            <XCircle className="h-4 w-4" /> বাতিল করুন
          </Button>
        )}
        {stats.failed_count > 0 && (
          <Button variant="secondary" disabled={busy} onClick={() => run(retryFailedMessages)}>
            <RotateCcw className="h-4 w-4" /> ব্যর্থগুলো আবার পাঠান
          </Button>
        )}
      </div>

      {data.failedMessages && data.failedMessages.length > 0 && (() => {
        const failedTotalPages = Math.ceil(data.failedMessages.length / FAILED_PAGE_SIZE);
        const safeFailedPage = Math.min(failedPage, failedTotalPages);
        const pagedFailedMessages = data.failedMessages.slice((safeFailedPage - 1) * FAILED_PAGE_SIZE, safeFailedPage * FAILED_PAGE_SIZE);
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">ব্যর্থ মেসেজের তালিকা ({data.failedMessages.length})</p>
            <div className="flex flex-col gap-2">
              {pagedFailedMessages.map((m) => (
                <Card key={m.id} className="border-danger-light">
                  <p className="text-sm text-text">
                    <strong className="font-medium">{contactName(m.contacts)}</strong> · {m.phone}
                    {m.retry_count > 0 && <span className="text-text-muted"> · {m.retry_count} বার চেষ্টা হয়েছে</span>}
                  </p>
                  <p className="mt-1 text-sm text-danger">{m.failed_reason ?? "কারণ জানা যায়নি"}</p>
                </Card>
              ))}
            </div>
            <Pagination currentPage={safeFailedPage} totalPages={failedTotalPages} onPageChange={setFailedPage} />
          </div>
        );
      })()}
    </div>
  );
}

function StatBox({ label, value, variant }: { label: string; value: number; variant?: "danger" | "warning" }) {
  return (
    <Card className="text-center">
      <div className={`text-xl font-semibold ${variant === "danger" ? "text-danger" : variant === "warning" ? "text-warning" : "text-text"}`}>
        {value}
      </div>
      <div className="text-xs text-text-muted">{label}</div>
    </Card>
  );
}
