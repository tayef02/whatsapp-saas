"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, RotateCcw, Lock, Unlock } from "lucide-react";
import { Card, Button, Input } from "@/components/ui";
import { getInviteLink, rotateInviteLink, toggleAdminOnlyMode, updateMaxDailyScheduled } from "../actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Group = {
  id: string;
  description: string | null;
  member_count: number;
  invite_code: string | null;
  is_admin_only_mode: boolean;
  max_daily_scheduled_messages: number;
  last_synced_at: string | null;
};

export default function GroupOverview({ group, adminCount }: { group: Group; adminCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState(group.max_daily_scheduled_messages);

  async function handleGetInvite() {
    setBusy(true);
    setError(null);
    const res = await getInviteLink(group.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleRotateInvite() {
    if (!confirm("ইনভাইট লিংক রোটেট করলে আগের লিংকটা আর কাজ করবে না। এগিয়ে যাবেন?")) return;
    setBusy(true);
    setError(null);
    const res = await rotateInviteLink(group.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleToggleAdminOnly() {
    setBusy(true);
    setError(null);
    const res = await toggleAdminOnlyMode(group.id, !group.is_admin_only_mode);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleSaveDailyLimit() {
    setBusy(true);
    setError(null);
    const res = await updateMaxDailyScheduled(group.id, dailyLimit);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-text-muted">মেম্বার</p>
          <p className="text-2xl font-semibold text-text">{group.member_count}</p>
          <p className="text-xs text-text-muted">{adminCount} জন অ্যাডমিন</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">সর্বশেষ সিঙ্ক</p>
          <p className="text-sm font-medium text-text">{group.last_synced_at ? formatDhakaDateTime(group.last_synced_at) : "এখনো সিঙ্ক হয়নি"}</p>
        </Card>
      </div>

      {group.description && (
        <Card>
          <p className="mb-1 text-xs font-medium text-text-muted">বর্ণনা</p>
          <p className="text-sm text-text">{group.description}</p>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-sm font-semibold text-text">ইনভাইট লিংক</p>
        {group.invite_code ? (
          <p className="mb-3 text-sm break-all text-info">https://chat.whatsapp.com/{group.invite_code}</p>
        ) : (
          <p className="mb-3 text-sm text-text-muted">এখনো ইনভাইট লিংক আনা হয়নি।</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={handleGetInvite}>
            <Link2 className="h-4 w-4" /> {group.invite_code ? "আবার আনুন" : "ইনভাইট লিংক আনুন"}
          </Button>
          {group.invite_code && (
            <Button variant="danger" disabled={busy} onClick={handleRotateInvite}>
              <RotateCcw className="h-4 w-4" /> রোটেট করুন
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <p className="mb-1 text-sm font-semibold text-text">Admin-only পোস্ট মোড</p>
        <p className="mb-3 text-xs text-text-muted">চালু থাকলে শুধু গ্রুপ অ্যাডমিনরাই মেসেজ পাঠাতে পারবে।</p>
        <Button variant="secondary" disabled={busy} onClick={handleToggleAdminOnly}>
          {group.is_admin_only_mode ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {group.is_admin_only_mode ? "সবাই পোস্ট করতে পারবে (বন্ধ করুন)" : "শুধু Admin পোস্ট করবে (চালু করুন)"}
        </Button>
      </Card>

      <Card>
        <p className="mb-1 text-sm font-semibold text-text">দৈনিক শিডিউল লিমিট</p>
        <p className="mb-3 text-xs text-text-muted">এই গ্রুপে দিনে সর্বোচ্চ কতগুলো শিডিউলড অ্যানাউন্সমেন্ট/পোল যাবে (স্প্যামের মতো না লাগার জন্য)</p>
        <div className="flex max-w-xs items-end gap-2">
          <Input type="number" min={0} step={1} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
          <Button disabled={busy} onClick={handleSaveDailyLimit}>
            সেভ করুন
          </Button>
        </div>
      </Card>
    </div>
  );
}
