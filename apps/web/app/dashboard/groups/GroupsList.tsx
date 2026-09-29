"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Webhook, Users, Lock, ShieldAlert, Flag } from "lucide-react";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { syncGroups, resyncWebhook } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type WhatsappNumber = { id: string; display_name: string };
type GroupCard = {
  id: string;
  name: string | null;
  description: string | null;
  member_count: number;
  is_admin_only_mode: boolean;
  welcome_enabled: boolean;
  last_synced_at: string | null;
  number_name: string | null;
  flagged_count: number;
};

export default function GroupsList({
  numbers,
  groups,
  spamFilterActive,
}: {
  numbers: WhatsappNumber[];
  groups: GroupCard[];
  spamFilterActive: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync(numberId: string) {
    setBusyId(numberId);
    setError(null);
    const res = await syncGroups(numberId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleResyncWebhook(numberId: string) {
    setBusyId(`webhook-${numberId}`);
    setError(null);
    const res = await resyncWebhook(numberId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    alert("Webhook ইভেন্ট রিফ্রেশ হয়েছে — এখন থেকে নতুন মেম্বার জয়েন করলে ইভেন্ট পাওয়া যাবে।");
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <Card>
        <p className="mb-3 text-sm font-semibold text-text">নাম্বার থেকে সিঙ্ক</p>
        {numbers.length === 0 ? (
          <p className="text-sm text-text-muted">এখনো কোনো WhatsApp নাম্বার কানেক্ট করা হয়নি।</p>
        ) : (
          <div className="flex flex-col gap-2">
            {numbers.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-text">{n.display_name}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={busyId === n.id} onClick={() => handleSync(n.id)}>
                    <RefreshCw className="h-3.5 w-3.5" /> {busyId === n.id ? "সিঙ্ক হচ্ছে..." : "সিঙ্ক করুন"}
                  </Button>
                  <Button variant="ghost" disabled={busyId === `webhook-${n.id}`} onClick={() => handleResyncWebhook(n.id)}>
                    <Webhook className="h-3.5 w-3.5" /> Webhook রিফ্রেশ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
              <Card className="flex h-full flex-col gap-2 hover:border-primary">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold text-text">{g.name || "(নাম নেই)"}</p>
                  {g.flagged_count > 0 && (
                    <Badge variant="warning" className="shrink-0">
                      <Flag className="h-3 w-3" /> {g.flagged_count}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-muted">{g.number_name}</p>

                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                  <Users className="h-3.5 w-3.5" /> {g.member_count} জন মেম্বার
                </div>

                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.is_admin_only_mode && (
                    <Badge variant="info">
                      <Lock className="h-3 w-3" /> Admin-only
                    </Badge>
                  )}
                  <Badge variant={spamFilterActive ? "success" : "neutral"}>
                    <ShieldAlert className="h-3 w-3" /> স্প্যাম ফিল্টার {spamFilterActive ? "চালু" : "বন্ধ"}
                  </Badge>
                  {g.welcome_enabled && <Badge variant="neutral">ওয়েলকাম চালু</Badge>}
                </div>

                {g.last_synced_at && <p className="mt-auto pt-2 text-xs text-text-muted">সর্বশেষ সিঙ্ক: {formatDhakaDateTime(g.last_synced_at)}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
