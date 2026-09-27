"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAnnouncement, cancelAnnouncement } from "./actions";

type Group = { id: string; name: string | null };
type Target = { group_name: string | null; status: string; error_message: string | null };
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

const statusLabel: Record<string, string> = {
  pending: "⏳ অপেক্ষমান",
  sending: "পাঠানো হচ্ছে...",
  sent: "✅ প্রসেস হয়ে গেছে",
  cancelled: "❌ বাতিল",
};

const targetStatusLabel: Record<string, string> = {
  pending: "⏳ পাঠানোর অপেক্ষায়",
  sent: "✅ পাঠানো হয়েছে",
  failed: "❌ ব্যর্থ",
  skipped_limit: "⏭️ দৈনিক লিমিটের কারণে বাদ",
};

export default function AnnouncementsList({ groups, announcements }: { groups: Group[]; announcements: Announcement[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPoll, setIsPoll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await createAnnouncement(formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleCancel(id: string) {
    if (!confirm("এই অ্যানাউন্সমেন্টটা বাতিল করবেন?")) return;
    setBusy(true);
    await cancelAnnouncement(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <form action={handleCreate} className="auth-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>নতুন শিডিউল</h2>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" name="isPoll" checked={isPoll} onChange={(e) => setIsPoll(e.target.checked)} style={{ width: "auto" }} />
          এটা একটা পোল
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          {isPoll ? "পোলের প্রশ্ন" : "মেসেজ টেক্সট"}
          <textarea name="messageText" rows={3} required style={{ width: "100%" }} />
        </label>

        {isPoll && (
          <>
            <label style={{ display: "block", marginTop: 12 }}>
              পোল অপশন (কমা দিয়ে আলাদা করুন)
              <input type="text" name="pollOptions" placeholder="যেমন: হ্যাঁ, না, জানি না" style={{ width: "100%" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <input type="checkbox" name="pollMultiSelect" style={{ width: "auto" }} />
              একাধিক অপশন বাছাই করা যাবে
            </label>
          </>
        )}

        <label style={{ display: "block", marginTop: 12 }}>
          কখন পাঠাতে হবে
          <input type="datetime-local" name="scheduledAt" required style={{ width: "100%" }} />
        </label>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>কোন গ্রুপ(গুলো)-এ পাঠাতে হবে</div>
          {groups.length === 0 && <p style={{ color: "#666", fontSize: 13 }}>কোনো গ্রুপ sync করা নেই।</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {groups.map((g) => (
              <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" name="groupIds" value={g.id} style={{ width: "auto" }} />
                {g.name || "(নাম নেই)"}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          শিডিউল করুন
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>শিডিউল লিস্ট</h2>
      {announcements.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো শিডিউল নেই।</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {announcements.map((a) => (
          <div key={a.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                {a.poll_options && <div style={{ color: "#2563eb", marginBottom: 2 }}>📊 পোল{a.poll_multi_select ? " (মাল্টি-সিলেক্ট)" : ""}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{a.message_text}</div>
                {a.poll_options && <div style={{ color: "#666", marginTop: 2 }}>অপশন: {a.poll_options.join(", ")}</div>}
                <div style={{ color: "#999", marginTop: 4, fontSize: 12 }}>
                  শিডিউল: {new Date(a.scheduled_at).toLocaleString("bn-BD")} — {statusLabel[a.status] ?? a.status}
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0, marginTop: 6 }}
                >
                  {expandedId === a.id ? "গ্রুপ-ভিত্তিক স্ট্যাটাস লুকান" : `গ্রুপ-ভিত্তিক স্ট্যাটাস দেখুন (${a.targets.length})`}
                </button>
                {expandedId === a.id && (
                  <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: 8, fontSize: 11 }}>
                    {a.targets.map((t, i) => (
                      <div key={i}>
                        {t.group_name || "(নাম নেই)"} — {targetStatusLabel[t.status] ?? t.status}
                        {t.error_message && ` (${t.error_message})`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {a.status === "pending" && (
                <button disabled={busy} onClick={() => handleCancel(a.id)} style={{ width: "auto", color: "#dc2626", flexShrink: 0 }}>
                  বাতিল করুন
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
