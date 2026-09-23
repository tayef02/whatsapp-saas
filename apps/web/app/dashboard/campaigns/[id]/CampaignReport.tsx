"use client";

import { useEffect, useState } from "react";
import { pauseCampaign, resumeCampaign, cancelCampaign, retryFailedMessages } from "./actions";

type Stats = {
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  unknown_count: number;
};

type CampaignData = {
  id: string;
  status: string;
  paused_reason: string | null;
  campaign_stats: Stats | Stats[] | null;
};

const statusLabel: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "শিডিউল হয়েছে",
  sending: "পাঠানো হচ্ছে",
  paused: "পজ করা",
  cancelled: "বাতিল",
  completed: "শেষ হয়েছে",
  failed: "ব্যর্থ",
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

export default function CampaignReport({ initial }: { initial: CampaignData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>ক্যাম্পেইন রিপোর্ট</h1>
        <span style={{ fontSize: 13, padding: "4px 10px", borderRadius: 999, background: "#f3f4f6" }}>
          {statusLabel[data.status] ?? data.status}
        </span>
      </div>

      {data.paused_reason && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ⏸️ পজ হওয়ার কারণ: {pausedReasonLabel[data.paused_reason] ?? data.paused_reason}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="মোট" value={stats.total_recipients} />
        <StatBox label="পাঠানো হয়েছে" value={stats.sent_count} />
        <StatBox label="ডেলিভার্ড" value={stats.delivered_count} />
        <StatBox label="পড়া হয়েছে" value={stats.read_count} />
        <StatBox label="ব্যর্থ" value={stats.failed_count} color="#dc2626" />
        <StatBox label="অজানা" value={stats.unknown_count} color="#b45309" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data.status === "sending" && (
          <button disabled={busy} onClick={() => run(pauseCampaign)}>
            পজ করুন
          </button>
        )}
        {data.status === "paused" && (
          <button disabled={busy} onClick={() => run(resumeCampaign)}>
            আবার চালু করুন
          </button>
        )}
        {["draft", "scheduled", "sending", "paused"].includes(data.status) && (
          <button disabled={busy} onClick={() => run(cancelCampaign)} style={{ background: "white", color: "#dc2626", border: "1px solid #dc2626" }}>
            বাতিল করুন
          </button>
        )}
        {stats.failed_count > 0 && (
          <button disabled={busy} onClick={() => run(retryFailedMessages)} style={{ background: "#eee", color: "#333" }}>
            ব্যর্থগুলো আবার পাঠান
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 12, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "#111" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
    </div>
  );
}
