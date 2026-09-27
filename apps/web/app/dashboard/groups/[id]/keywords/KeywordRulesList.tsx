"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addKeywordRule, toggleKeywordRule, deleteKeywordRule } from "./actions";

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
    <div>
      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <form action={handleAdd} className="auth-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>নতুন ট্রিগার রুল</h2>

        <label>
          ট্রিগার
          <select name="triggerType" value={triggerType} onChange={(e) => setTriggerType(e.target.value)} style={{ width: "100%" }}>
            <option value="keyword">কিওয়ার্ড</option>
            <option value="mention">@Mention (bot-কে ট্যাগ করলে)</option>
          </select>
        </label>

        {triggerType === "keyword" && (
          <label style={{ display: "block", marginTop: 12 }}>
            কিওয়ার্ড
            <input type="text" name="keyword" placeholder="যেমন: দাম" style={{ width: "100%" }} />
          </label>
        )}

        <label style={{ display: "block", marginTop: 12 }}>
          রিপ্লাই মোড
          <select name="replyMode" value={replyMode} onChange={(e) => setReplyMode(e.target.value)} style={{ width: "100%" }}>
            <option value="fixed">ফিক্সড টেক্সট</option>
            <option value="ai">AI দিয়ে উত্তর</option>
          </select>
        </label>

        {replyMode === "fixed" && (
          <label style={{ display: "block", marginTop: 12 }}>
            রিপ্লাই টেক্সট
            <textarea name="replyText" rows={3} placeholder="যেমন: আমাদের প্রাইস লিস্ট দেখতে..." style={{ width: "100%" }} />
          </label>
        )}
        {replyMode === "ai" && (
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            AI মোডে workspace-এর AI Chatbot সেটিংস (system prompt, knowledge base) থেকে উত্তর জেনারেট হবে, এখানে আলাদা
            টেক্সট লেখা লাগবে না।
          </p>
        )}

        <label style={{ display: "block", marginTop: 12 }}>
          Cooldown (মিনিট) — {replyMode === "ai" ? "কত ঘন ঘন AI call হতে পারবে" : "একই রিপ্লাই কত ঘন ঘন যেতে পারবে"}
          <input type="number" name="cooldownMinutes" defaultValue={5} min={0} step={1} style={{ width: "100%" }} />
        </label>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          যোগ করুন
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>বিদ্যমান রুল</h2>
      {rules.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো রুল নেই।</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.map((r) => (
          <div key={r.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <strong>{r.trigger_type === "mention" ? "@Mention" : r.keyword}</strong>{" "}
                <span style={{ color: "#666" }}>{r.reply_mode === "ai" ? "🤖 AI" : "📝 ফিক্সড"}</span>
                {r.reply_mode === "fixed" && <div style={{ color: "#666", marginTop: 4, whiteSpace: "pre-wrap" }}>{r.reply_text}</div>}
                <div style={{ color: "#999", marginTop: 4, fontSize: 12 }}>
                  cooldown: {Math.round(r.cooldown_seconds / 60)} মিনিট
                  {r.last_triggered_at && ` — সর্বশেষ ট্রিগার: ${new Date(r.last_triggered_at).toLocaleString("bn-BD")}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button disabled={busy} onClick={() => handleToggle(r.id, !r.is_active)} style={{ width: "auto" }}>
                  {r.is_active ? "বন্ধ করুন" : "চালু করুন"}
                </button>
                <button disabled={busy} onClick={() => handleDelete(r.id)} style={{ width: "auto", color: "#dc2626" }}>
                  মুছুন
                </button>
              </div>
            </div>
            {!r.is_active && <div style={{ marginTop: 6, fontSize: 11, color: "#b45309" }}>⏸️ বন্ধ আছে</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
