"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendAgentReply, setConversationStatus } from "./actions";

type Message = {
  id: string;
  direction: string;
  sender_type: string;
  content: string;
  created_at: string;
};

const senderLabel: Record<string, string> = {
  customer: "কাস্টমার",
  bot: "Auto-Reply",
  agent: "আপনি",
};

const bubbleStyle = (direction: string): React.CSSProperties => ({
  alignSelf: direction === "inbound" ? "flex-start" : "flex-end",
  background: direction === "inbound" ? "white" : "#dcfce7",
  border: "1px solid #eee",
  borderRadius: 10,
  padding: "8px 12px",
  maxWidth: "70%",
});

export default function ConversationThread({
  conversationId,
  status,
  contactLabel,
  numberLabel,
  messages,
}: {
  conversationId: string;
  status: string;
  contactLabel: string;
  numberLabel: string;
  messages: Message[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await sendAgentReply(conversationId, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleStatus(newStatus: "active" | "resolved") {
    setBusy(true);
    await setConversationStatus(conversationId, newStatus);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>{contactLabel}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>{numberLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "handed_off" && (
            <button disabled={busy} onClick={() => handleStatus("active")} style={{ width: "auto" }}>
              Auto-Reply আবার চালু করুন
            </button>
          )}
          {status !== "resolved" && (
            <button disabled={busy} onClick={() => handleStatus("resolved")} style={{ width: "auto" }}>
              সমাধান হয়েছে
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {messages.map((m) => (
          <div key={m.id} style={bubbleStyle(m.direction)}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{senderLabel[m.sender_type] ?? m.sender_type}</div>
            <div style={{ fontSize: 14 }}>{m.content}</div>
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো মেসেজ নেই।</p>}
      </div>

      <form action={handleSend} style={{ display: "flex", gap: 8 }}>
        <input type="text" name="text" placeholder="রিপ্লাই লিখুন..." required style={{ flex: 1 }} />
        <button type="submit" disabled={busy} style={{ width: "auto", flex: "0 0 auto" }}>
          পাঠান
        </button>
      </form>
    </div>
  );
}
