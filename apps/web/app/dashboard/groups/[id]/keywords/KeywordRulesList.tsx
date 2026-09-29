"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Bot, FileText, MessageSquareText, Trash2 } from "lucide-react";
import { Card, Input, Select, Textarea, Button, Badge, EmptyState, useToast } from "@/components/ui";
import { addKeywordRule, toggleKeywordRule, deleteKeywordRule } from "./actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Rule = {
  id: string;
  trigger_type: string;
  reply_mode: string;
  keyword: string | null;
  reply_text: string | null;
  cooldown_seconds: number;
  is_active: boolean;
  last_triggered_at: string | null;
};

export default function KeywordRulesList({ groupId, rules }: { groupId: string; rules: Rule[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState("keyword");
  const [replyMode, setReplyMode] = useState("fixed");

  async function handleAdd(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await addKeywordRule(groupId, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    showToast("success", "রুল যোগ হয়েছে");
    router.refresh();
  }

  async function handleToggle(ruleId: string, isActive: boolean) {
    setBusy(true);
    await toggleKeywordRule(ruleId, groupId, isActive);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("এই রুলটা মুছে ফেলবেন?")) return;
    setBusy(true);
    await deleteKeywordRule(ruleId, groupId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="max-w-xl">
        <p className="mb-3 text-sm font-semibold text-text">নতুন ট্রিগার রুল</p>

        <form action={handleAdd} className="flex flex-col gap-4">
          <Select name="triggerType" label="ট্রিগার" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
            <option value="keyword">কিওয়ার্ড</option>
            <option value="mention">@Mention (bot-কে ট্যাগ করলে)</option>
          </Select>

          {triggerType === "mention" && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              সেভ করা কন্টাক্ট নাম সিলেক্ট করে মেনশন করলে WhatsApp-এর LID প্রাইভেসি সিস্টেমের কারণে বট চিনতে পারে না। এড়াতে —
              কন্টাক্ট নাম সিলেক্ট না করে সরাসরি ফোন নাম্বার টাইপ করে মেনশন করুন (যেমন "@৮৮০১৯৩৮১৮৭৮০২")।
            </p>
          )}

          {triggerType === "keyword" && <Input name="keyword" label="কিওয়ার্ড" placeholder="যেমন: দাম" />}

          <Select name="replyMode" label="রিপ্লাই মোড" value={replyMode} onChange={(e) => setReplyMode(e.target.value)}>
            <option value="fixed">ফিক্সড টেক্সট</option>
            <option value="ai">AI দিয়ে উত্তর</option>
          </Select>

          {replyMode === "fixed" && <Textarea name="replyText" label="রিপ্লাই টেক্সট" rows={3} placeholder="যেমন: আমাদের প্রাইস লিস্ট দেখতে..." />}
          {replyMode === "ai" && (
            <p className="text-xs text-text-muted">AI মোডে workspace-এর AI Chatbot সেটিংস (system prompt, knowledge base) থেকে উত্তর জেনারেট হবে।</p>
          )}

          <Input
            type="number"
            name="cooldownMinutes"
            label={`Cooldown (মিনিট) — ${replyMode === "ai" ? "কত ঘন ঘন AI call হতে পারবে" : "একই রিপ্লাই কত ঘন ঘন যেতে পারবে"}`}
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
          <EmptyState icon={<MessageSquareText className="h-10 w-10" />} title="এখনো কোনো রুল নেই" description="উপরের ফর্ম দিয়ে প্রথম ট্রিগার রুল বানান।" />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <Card key={r.id} className={!r.is_active ? "opacity-60" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-text">{r.trigger_type === "mention" ? "@Mention" : r.keyword}</span>
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
