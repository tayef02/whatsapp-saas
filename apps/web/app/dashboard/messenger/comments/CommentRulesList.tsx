"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, FileText, MessageSquareText, Trash2, Inbox, MessageCircleReply } from "lucide-react";
import { Card, Input, Select, Textarea, Button, Badge, EmptyState, useToast } from "@/components/ui";
import { addCommentRule, toggleCommentRule, deleteCommentRule } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Rule = {
  id: string;
  trigger_type: string;
  keyword: string | null;
  action: string;
  reply_mode: string;
  reply_text: string | null;
  cooldown_seconds: number;
  is_active: boolean;
  last_triggered_at: string | null;
};

export default function CommentRulesList({ pageId, rules }: { pageId: string; rules: Rule[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState("keyword");
  const [action, setAction] = useState("public_reply");
  const [replyMode, setReplyMode] = useState("fixed");

  async function handleAdd(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await addCommentRule(pageId, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    showToast("success", "রুল যোগ হয়েছে");
    router.refresh();
  }

  async function handleToggle(ruleId: string, isActive: boolean) {
    setBusy(true);
    await toggleCommentRule(ruleId, isActive);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("এই রুলটা মুছে ফেলবেন?")) return;
    setBusy(true);
    await deleteCommentRule(ruleId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="max-w-xl">
        <p className="mb-3 text-sm font-semibold text-text">নতুন কমেন্ট রুল</p>

        <form action={handleAdd} className="flex flex-col gap-4">
          <Select name="triggerType" label="ট্রিগার" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
            <option value="keyword">কিওয়ার্ড</option>
            <option value="all">এই পেজের সব নতুন কমেন্ট</option>
          </Select>

          {triggerType === "keyword" && <Input name="keyword" label="কিওয়ার্ড" placeholder="যেমন: দাম" />}

          <Select name="action" label="অ্যাকশন" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="public_reply">কমেন্টের নিচে পাবলিক রিপ্লাই</option>
            <option value="private_reply">ইনবক্সে Private Reply পাঠান</option>
          </Select>
          {action === "private_reply" && (
            <p className="text-xs text-text-muted">
              Private Reply সফল হলে একটা কথোপকথন তৈরি হয়ে Messenger ইনবক্সে দেখা যাবে। কমেন্টকারী আগে কখনো পেজে মেসেজ না
              করে থাকলেও কাজ করে — Meta এর নিয়ম অনুযায়ী প্রতি কমেন্টে একবারই পাঠানো যায়।
            </p>
          )}
          {action === "public_reply" && (
            <p className="text-xs text-text-muted">
              টিপস: কাস্টমার আগে কখনো পেজে মেসেজ না করে থাকলে প্রথম DM "Message Requests" ফোল্ডারে চলে যেতে পারে, মূল
              ইনবক্সে না — তাই রিপ্লাই টেক্সটে "ইনবক্স/Message Requests চেক করুন" জাতীয় কথা যোগ করা ভালো।
            </p>
          )}

          <Select name="replyMode" label="রিপ্লাই মোড" value={replyMode} onChange={(e) => setReplyMode(e.target.value)}>
            <option value="fixed">ফিক্সড টেক্সট</option>
            <option value="ai">AI দিয়ে উত্তর</option>
          </Select>

          {replyMode === "fixed" && (
            <Textarea
              name="replyText"
              label="রিপ্লাই টেক্সট (স্পিনট্যাক্স সাপোর্ট করে, যেমন: {ধন্যবাদ|থ্যাংকস}! দাম {৫০০|৫০০ টাকা} — ইনবক্স করুন।)"
              rows={3}
              placeholder="যেমন: {ধন্যবাদ জানানোর জন্য|আপনাকে ধন্যবাদ}! দাম ৫০০ টাকা {।|, কিনতে ইনবক্স করুন}"
            />
          )}
          {replyMode === "ai" && (
            <p className="text-xs text-text-muted">
              AI মোডে workspace-এর Messenger AI Chatbot সেটিংস (system prompt, নলেজ বেস) থেকে উত্তর জেনারেট হবে — WhatsApp
              এর AI সেটিংস থেকে আলাদা।
            </p>
          )}

          <Input
            type="number"
            name="cooldownMinutes"
            label="Cooldown (মিনিট) — এই রুল কত ঘন ঘন আবার ট্রিগার হতে পারবে (স্প্যাম ঠেকাতে)"
            defaultValue={5}
            min={0}
            step={1}
          />

          <Button type="submit" disabled={busy} className="self-start">
            যোগ করুন
          </Button>
        </form>
      </Card>

      <div>
        <p className="mb-3 text-sm font-semibold text-text">বিদ্যমান রুল</p>
        {rules.length === 0 ? (
          <EmptyState icon={<MessageSquareText className="h-10 w-10" />} title="এখনো কোনো রুল নেই" description="উপরের ফর্ম দিয়ে প্রথম কমেন্ট রুল বানান।" />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <Card key={r.id} className={!r.is_active ? "opacity-60" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-text">{r.trigger_type === "all" ? "সব কমেন্ট" : r.keyword}</span>
                      <Badge variant={r.action === "private_reply" ? "info" : "neutral"}>
                        {r.action === "private_reply" ? <Inbox className="h-3 w-3" /> : <MessageCircleReply className="h-3 w-3" />}
                        {r.action === "private_reply" ? "Private Reply" : "পাবলিক রিপ্লাই"}
                      </Badge>
                      <Badge variant={r.reply_mode === "ai" ? "info" : "neutral"}>
                        {r.reply_mode === "ai" ? <Bot className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                        {r.reply_mode === "ai" ? "AI" : "ফিক্সড"}
                      </Badge>
                      {!r.is_active && <Badge variant="warning">বন্ধ আছে</Badge>}
                    </div>
                    {r.reply_mode === "fixed" && <p className="mt-1 text-sm whitespace-pre-wrap text-text-muted">{r.reply_text}</p>}
                    <p className="mt-1 text-xs text-text-muted">
                      cooldown: {Math.round(r.cooldown_seconds / 60)} মিনিট
                      {r.last_triggered_at && ` — সর্বশেষ ট্রিগার: ${formatDhakaDateTime(r.last_triggered_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="secondary" disabled={busy} onClick={() => handleToggle(r.id, !r.is_active)}>
                      {r.is_active ? "বন্ধ করুন" : "চালু করুন"}
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
