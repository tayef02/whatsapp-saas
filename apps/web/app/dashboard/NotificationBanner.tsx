"use client";

import { useState } from "react";
import { markNotificationRead } from "./notifications-actions";

type Notification = { id: string; title: string; body: string | null };

export default function NotificationBanner({ notifications }: { notifications: Notification[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  async function dismiss(id: string) {
    setDismissed((d) => [...d, id]);
    await markNotificationRead(id);
  }

  return (
    <div style={{ padding: "0 24px", paddingTop: 16 }}>
      {visible.map((n) => (
        <div
          key={n.id}
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong style={{ fontSize: 13 }}>⚠️ {n.title}</strong>
            {n.body && <div style={{ fontSize: 12, color: "#555" }}>{n.body}</div>}
          </div>
          <button
            onClick={() => dismiss(n.id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e", fontSize: 13 }}
          >
            বন্ধ করুন
          </button>
        </div>
      ))}
    </div>
  );
}
