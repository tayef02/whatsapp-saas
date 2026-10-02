"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, History } from "lucide-react";
import { Card, Select, Textarea, Button, Badge, EmptyState, useToast, Pagination } from "@/components/ui";
import { formatDhakaDateTime } from "@/lib/format-date";
import { sendSkippedCommentNow, dismissSkippedComment } from "./actions";
import { SKIP_REASON_LABEL, SKIP_STATUS_LABEL } from "../skip-reasons";

type SkipRow = {
  id: string;
  comment_id: string;
  post_id: string | null;
  from_psid: string | null;
  from_name: string | null;
  comment_text_excerpt: string | null;
  reply_text: string | null;
  action: "public_reply" | "private_reply" | null;
  reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending_review: "warning",
  sent_manually: "success",
  dismissed: "neutral",
};

export default function SkippedCommentsList({
  pageId,
  skips,
  pendingCount,
  currentReason,
  currentStatus,
  skipPage,
  totalPages,
}: {
  pageId: string;
  skips: SkipRow[];
  pendingCount: number;
  currentReason: string;
  currentStatus: string;
  skipPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openSendId, setOpenSendId] = useState<string | null>(null);
  const [sendAction, setSendAction] = useState<"public_reply" | "private_reply">("public_reply");
  const [sendText, setSendText] = useState("");

  function updateFilter(next: { reason?: string; status?: string }) {
    const params = new URLSearchParams();
    params.set("page", pageId);
    const reason = next.reason ?? currentReason;
    const status = next.status ?? currentStatus;
    if (reason) params.set("reason", reason);
    if (status) params.set("status", status);
    router.push(`/dashboard/messenger/comments/skipped?${params.toString()}`);
  }

  function goToSkipPage(p: number) {
    const params = new URLSearchParams();
    params.set("page", pageId);
    if (currentReason) params.set("reason", currentReason);
    if (currentStatus) params.set("status", currentStatus);
    if (p > 1) params.set("skipPage", String(p));
    router.push(`/dashboard/messenger/comments/skipped?${params.toString()}`);
  }

  function openSendForm(skip: SkipRow) {
    setOpenSendId(skip.id);
    setSendAction(skip.action ?? "public_reply");
    setSendText(skip.reply_text ?? "");
  }

  async function handleSend(skipId: string) {
    setBusyId(skipId);
    const res = await sendSkippedCommentNow(skipId, sendAction, sendText);
    setBusyId(null);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "পাঠানোর জন্য queue তে বসানো হয়েছে");
    setOpenSendId(null);
    router.refresh();
  }

  async function handleDismiss(skipId: string) {
    setBusyId(skipId);
    const res = await dismissSkippedComment(skipId);
    setBusyId(null);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "বাদ দেওয়া হয়েছে");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="স্ট্যাটাস"
          value={currentStatus}
          onChange={(e) => updateFilter({ status: e.target.value })}
          className="w-48"
        >
          <option value="pending_review">পর্যালোচনার অপেক্ষায় ({pendingCount})</option>
          <option value="sent_manually">ম্যানুয়ালি পাঠানো হয়েছে</option>
          <option value="dismissed">বাদ দেওয়া হয়েছে</option>
          <option value="all">সব</option>
        </Select>
        <Select label="কারণ" value={currentReason} onChange={(e) => updateFilter({ reason: e.target.value })} className="w-56">
          <option value="">সব কারণ</option>
          {Object.entries(SKIP_REASON_LABEL).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {skips.length === 0 ? (
        <Card>
          <EmptyState icon={<History className="h-10 w-10" />} title="এই ফিল্টারে কোনো স্কিপ হওয়া কমেন্ট নেই" />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {skips.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-text">{s.from_name || s.from_psid || "(অজানা কাস্টমার)"}</span>
                    <Badge variant={statusVariant[s.status] ?? "neutral"}>{SKIP_STATUS_LABEL[s.status] ?? s.status}</Badge>
                    <Badge variant="neutral">{SKIP_REASON_LABEL[s.reason] ?? s.reason}</Badge>
                    {s.action && <Badge variant="info">{s.action === "private_reply" ? "Private Reply" : "পাবলিক রিপ্লাই"}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{s.comment_text_excerpt || "(কমেন্টের লেখা নেই)"}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatDhakaDateTime(s.created_at)}</p>
                </div>

                {s.status === "pending_review" && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="secondary" disabled={busyId === s.id} onClick={() => openSendForm(s)}>
                      <Send className="h-3.5 w-3.5" /> এখন পাঠান
                    </Button>
                    <Button variant="danger" disabled={busyId === s.id} onClick={() => handleDismiss(s.id)}>
                      <X className="h-3.5 w-3.5" /> বাদ দিন
                    </Button>
                  </div>
                )}
              </div>

              {openSendId === s.id && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-gray-50 p-3">
                  <Select
                    label="অ্যাকশন"
                    value={sendAction}
                    onChange={(e) => setSendAction(e.target.value as "public_reply" | "private_reply")}
                  >
                    <option value="public_reply">কমেন্টের নিচে পাবলিক রিপ্লাই</option>
                    <option value="private_reply" disabled={!s.from_psid}>
                      ইনবক্সে Private Reply পাঠান {!s.from_psid && "(psid নেই)"}
                    </option>
                  </Select>
                  <Textarea label="রিপ্লাই টেক্সট" rows={3} value={sendText} onChange={(e) => setSendText(e.target.value)} />
                  <div className="flex gap-2">
                    <Button disabled={busyId === s.id} onClick={() => handleSend(s.id)}>
                      পাঠান
                    </Button>
                    <Button variant="secondary" disabled={busyId === s.id} onClick={() => setOpenSendId(null)}>
                      বাতিল
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Pagination currentPage={skipPage} totalPages={totalPages} onPageChange={goToSkipPage} />
    </div>
  );
}
