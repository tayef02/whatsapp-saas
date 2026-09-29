"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, ListChecks, MessageSquareText, Users, X } from "lucide-react";
import { Card, Input, Textarea, Button, Badge, EmptyState, useToast } from "@/components/ui";
import { createAnnouncement, cancelAnnouncement } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Group = { id: string; name: string | null };
type Target = { group_name: string | null; status: string; error_message: string | null; sent_at: string | null };
type Announcement = {
  id: string;
  message_text: string;
  poll_options: string[] | null;
  poll_multi_select: boolean;
  scheduled_at: string;
  status: string;
  created_at: string;
  targets: Target[];
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "info",
  sending: "warning",
  sent: "success",
  cancelled: "neutral",
};

const statusLabel: Record<string, string> = {
  pending: "নির্ধারিত",
  sending: "পাঠানো হচ্ছে",
  sent: "পাঠানো হয়েছে",
  cancelled: "বাতিল",
};

const targetStatusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "info",
  sent: "success",
  failed: "danger",
  skipped_limit: "warning",
};

const targetStatusLabel: Record<string, string> = {
  pending: "পাঠানোর অপেক্ষায়",
  sent: "পাঠানো হয়েছে",
  failed: "ব্যর্থ",
  skipped_limit: "দৈনিক লিমিটের কারণে বাদ",
};

export default function AnnouncementsList({ groups, announcements }: { groups: Group[]; announcements: Announcement[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [isPoll, setIsPoll] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setBusy(true);

    // <input type="datetime-local"> ব্রাউজারের local timezone অনুযায়ী একটা "naive" স্ট্রিং
    // দেয় (যেমন "2026-09-28T02:21", কোনো timezone তথ্য ছাড়া)। সার্ভার অ্যাকশনে কাঁচা অবস্থায়
    // পাঠালে সার্ভার ভুল timezone ধরে পার্স করে ফেলে — তাই ব্রাউজারেই সঠিক UTC instant এ কনভার্ট
    const rawScheduledAt = String(formData.get("scheduledAt") ?? "");
    if (rawScheduledAt) {
      formData.set("scheduledAt", new Date(rawScheduledAt).toISOString());
    }

    const res = await createAnnouncement(formData);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "শিডিউল করা হয়েছে");
    setSelectedGroups([]);
    router.refresh();
  }

  async function handleCancel(id: string) {
    if (!confirm("এই অ্যানাউন্সমেন্টটা বাতিল করবেন?")) return;
    setBusy(true);
    await cancelAnnouncement(id);
    setBusy(false);
    router.refresh();
  }

  function toggleGroup(id: string) {
    setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-xl">
        <p className="mb-3 text-sm font-semibold text-text">নতুন শিডিউল</p>

        <form action={handleCreate} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" name="isPoll" checked={isPoll} onChange={(e) => setIsPoll(e.target.checked)} className="h-4 w-4" />
            এটা একটা পোল
          </label>

          <Textarea name="messageText" label={isPoll ? "পোলের প্রশ্ন" : "মেসেজ টেক্সট"} rows={3} required />

          {isPoll && (
            <>
              <Input name="pollOptions" label="পোল অপশন (কমা দিয়ে আলাদা করুন)" placeholder="যেমন: হ্যাঁ, না, জানি না" />
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" name="pollMultiSelect" className="h-4 w-4" />
                একাধিক অপশন বাছাই করা যাবে
              </label>
            </>
          )}

          <Input type="datetime-local" name="scheduledAt" label="কখন পাঠাতে হবে (Asia/Dhaka)" required />

          <div>
            <p className="mb-1.5 text-sm font-medium text-text">কোন গ্রুপ(গুলো)-এ পাঠাতে হবে</p>
            {groups.length === 0 ? (
              <p className="text-sm text-text-muted">কোনো গ্রুপ sync করা নেই।</p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text hover:bg-gray-50">
                    <input type="checkbox" name="groupIds" value={g.id} checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} className="h-4 w-4" />
                    {g.name || "(নাম নেই)"}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-text-muted">
              প্রতিটা গ্রুপের নিজস্ব দৈনিক শিডিউল লিমিট আছে (ডিফল্ট ৩টা/দিন, গ্রুপ পেজের "সারাংশ" ট্যাব থেকে বদলানো যায়) —
              লিমিট শেষ হয়ে থাকলে সেই গ্রুপে আজ আর পাঠানো হবে না।
            </p>
          </div>

          <Button type="submit" disabled={busy} className="self-start">
            শিডিউল করুন
          </Button>
        </form>
      </Card>

      <div>
        <p className="mb-3 text-sm font-semibold text-text">শিডিউল লিস্ট</p>
        {announcements.length === 0 ? (
          <EmptyState icon={<MessageSquareText className="h-10 w-10" />} title="এখনো কোনো শিডিউল নেই" description="উপরের ফর্ম দিয়ে প্রথম অ্যানাউন্সমেন্ট বা পোল শিডিউল করুন।" />
        ) : (
          <div className="flex flex-col gap-2">
            {announcements.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={a.poll_options ? "info" : "neutral"}>
                        {a.poll_options ? <ListChecks className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
                        {a.poll_options ? `পোল${a.poll_multi_select ? " (মাল্টি-সিলেক্ট)" : ""}` : "মেসেজ"}
                      </Badge>
                      <Badge variant={statusVariant[a.status] ?? "neutral"}>{statusLabel[a.status] ?? a.status}</Badge>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Users className="h-3 w-3" /> {a.targets.length}টা গ্রুপ
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-text">{a.message_text}</p>
                    {a.poll_options && <p className="mt-1 text-xs text-text-muted">অপশন: {a.poll_options.join(", ")}</p>}
                    <p className="mt-1.5 text-xs text-text-muted">শিডিউল: {formatDhakaDateTime(a.scheduled_at)}</p>

                    <button
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      গ্রুপ-ভিত্তিক স্ট্যাটাস {expandedId === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {expandedId === a.id && (
                      <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-app-bg p-2.5">
                        {a.targets.map((t, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-text">{t.group_name || "(নাম নেই)"}</span>
                            <Badge variant={targetStatusVariant[t.status] ?? "neutral"}>{targetStatusLabel[t.status] ?? t.status}</Badge>
                            {t.sent_at && <span className="text-text-muted">{formatDhakaDateTime(t.sent_at)}</span>}
                            {t.error_message && <span className="text-danger">{t.error_message}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {a.status === "pending" && (
                    <Button variant="ghost" disabled={busy} onClick={() => handleCancel(a.id)} className="shrink-0 px-2 text-danger hover:bg-danger-light">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
