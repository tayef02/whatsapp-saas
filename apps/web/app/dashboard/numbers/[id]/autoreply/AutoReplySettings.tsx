"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveChatbotConfig } from "./actions";

type Config = {
  id: string;
  is_active: boolean;
  welcome_message: string | null;
  fallback_message: string | null;
};

export default function AutoReplySettings({ numberName, config }: { numberName: string; config: Config }) {
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

  return (
    <div>
      <h1>Auto-Reply — {numberName}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        চালু থাকলে কাস্টমারের প্রশ্নের উত্তর AI Chatbot (Knowledge Base) থেকে জেনারেট হয়ে যাবে। কোনো
        উত্তর না পেলে নিচের fallback বার্তা পাঠিয়ে কথোপকথন Inbox-এ এজেন্টের কাছে চলে যাবে। AI
        সেটআপ (system prompt, ডকুমেন্ট, API key) <a href="/dashboard/ai-chatbot">AI Chatbot পেজ</a>-এ করুন।
      </p>

      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <form action={handleSaveConfig} className="auth-card">
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input type="checkbox" name="isActive" defaultChecked={config.is_active} />
          Auto-Reply চালু রাখুন
        </label>

        <label>
          স্বাগত বার্তা (ঐচ্ছিক)
          <textarea name="welcomeMessage" defaultValue={config.welcome_message ?? ""} rows={2} style={{ width: "100%" }} />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Fallback বার্তা (AI কোনো উত্তর দিতে না পারলে এটা যাবে)
          <textarea name="fallbackMessage" defaultValue={config.fallback_message ?? ""} rows={2} style={{ width: "100%" }} />
        </label>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          সেভ করুন
        </button>
      </form>
    </div>
  );
}
