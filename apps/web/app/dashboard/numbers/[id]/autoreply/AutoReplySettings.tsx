"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveChatbotConfig, addRule, toggleRule, deleteRule } from "./actions";

type Config = {
  id: string;
  is_active: boolean;
  welcome_message: string | null;
  fallback_message: string | null;
};

type Rule = {
  id: string;
  keyword: string;
  match_type: string;
  reply_text: string;
  priority: number;
  is_active: boolean;
};

const matchTypeLabel: Record<string, string> = {
  contains: "মেসেজে এই শব্দ থাকলে",
  exact: "মেসেজ ঠিক এটাই হলে",
};

export default function AutoReplySettings({ numberName, config, rules }: { numberName: string; config: Config; rules: Rule[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveConfig(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await saveChatbotConfig(config.id, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleAddRule(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await addRule(config.id, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleToggle(ruleId: string, isActive: boolean) {
    setBusy(true);
    await toggleRule(ruleId, isActive);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("এই rule টা মুছে ফেলবেন?")) return;
    setBusy(true);
    await deleteRule(ruleId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <h1>Auto-Reply — {numberName}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        কোনো AI ব্যবহার হয় না — নির্দিষ্ট শব্দ দেখলে আগে থেকে লেখা রিপ্লাই পাঠানো হবে। কোনো rule না মিললে
        fallback মেসেজ পাঠিয়ে কথোপকথন Inbox-এ এজেন্টের কাছে চলে যাবে।
      </p>

      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <form action={handleSaveConfig} className="auth-card" style={{ marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input type="checkbox" name="isActive" defaultChecked={config.is_active} />
          Auto-Reply চালু রাখুন
        </label>

        <label>
          স্বাগত বার্তা (ঐচ্ছিক)
          <textarea name="welcomeMessage" defaultValue={config.welcome_message ?? ""} rows={2} style={{ width: "100%" }} />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Fallback বার্তা (কোনো rule না মিললে এটা যাবে)
          <textarea name="fallbackMessage" defaultValue={config.fallback_message ?? ""} rows={2} style={{ width: "100%" }} />
        </label>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          সেভ করুন
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Rules ({rules.length})</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {rules.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো rule নেই।</p>}
        {rules.map((r) => (
          <div
            key={r.id}
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              opacity: r.is_active ? 1 : 0.5,
            }}
          >
            <div style={{ fontSize: 13 }}>
              <div>
                <strong>"{r.keyword}"</strong> <span style={{ color: "#666" }}>({matchTypeLabel[r.match_type]})</span>
              </div>
              <div style={{ color: "#666", marginTop: 2 }}>→ {r.reply_text}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button disabled={busy} onClick={() => handleToggle(r.id, !r.is_active)} style={{ width: "auto", flex: "0 0 auto" }}>
                {r.is_active ? "বন্ধ করুন" : "চালু করুন"}
              </button>
              <button
                disabled={busy}
                onClick={() => handleDelete(r.id)}
                style={{ width: "auto", flex: "0 0 auto", color: "#dc2626" }}
              >
                মুছুন
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>নতুন Rule যোগ করুন</h2>
      <form action={handleAddRule} className="auth-card">
        <label>
          Keyword
          <input type="text" name="keyword" required placeholder="যেমন: দাম" style={{ width: "100%" }} />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          মিলানোর ধরন
          <select name="matchType" defaultValue="contains" style={{ width: "100%" }}>
            <option value="contains">মেসেজে এই শব্দ থাকলে</option>
            <option value="exact">মেসেজ ঠিক এটাই হলে</option>
          </select>
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Reply (এখানেও {"{{name}}"} আর spintax {"{Hi|Hello}"} কাজ করবে)
          <textarea name="replyText" required rows={3} style={{ width: "100%" }} />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Priority (ছোট সংখ্যা আগে চেক হবে)
          <input type="number" name="priority" defaultValue={0} style={{ width: 100 }} />
        </label>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          Rule যোগ করুন
        </button>
      </form>
    </div>
  );
}
