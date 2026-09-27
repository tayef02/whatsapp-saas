"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  syncGroups,
  getInviteLink,
  rotateInviteLink,
  resyncWebhook,
  updateWelcomeSettings,
  updateGroupFilters,
  toggleAdminOnlyMode,
  updateMaxDailyScheduled,
} from "./actions";

type Member = { phone: string; name: string | null; is_group_admin: boolean };
type Group = {
  id: string;
  name: string | null;
  description: string | null;
  member_count: number;
  invite_code: string | null;
  welcome_enabled: boolean;
  welcome_message: string | null;
  is_admin_only_mode: boolean;
  max_daily_scheduled_messages: number;
  last_synced_at: string | null;
  number_name: string | null;
  members: Member[];
};
type WhatsappNumber = { id: string; display_name: string };

function WelcomeSettingsForm({ group, onSaved }: { group: Group; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(group.welcome_enabled);
  const [message, setMessage] = useState(group.welcome_message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const res = await updateWelcomeSettings(group.id, enabled, message);
    setBusy(false);
    if (res.error) return setError(res.error);
    onSaved();
  }

  return (
    <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: 10, fontSize: 12 }}>
      {error && <p style={{ color: "#dc2626", marginBottom: 6 }}>{error}</p>}
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "auto" }} />
        নতুন মেম্বার জয়েন করলে ওয়েলকাম মেসেজ পাঠাবে
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="যেমন: {{group_name}} গ্রুপে স্বাগতম! গ্রুপ রুলস মেনে চলুন। ইনভাইট লিংক: {{invite_link}}"
        style={{ width: "100%", marginTop: 6 }}
      />
      <p style={{ color: "#999", marginTop: 4 }}>
        প্লেসহোল্ডার: <code>{"{{group_name}}"}</code>, <code>{"{{invite_link}}"}</code> (আগে "ইনভাইট লিংক আনুন" চাপলে বসবে)
      </p>
      <button disabled={busy} onClick={handleSave} style={{ width: "auto", marginTop: 6 }}>
        সেভ করুন
      </button>
    </div>
  );
}

function MaxDailyScheduledForm({ group, onSaved }: { group: Group; onSaved: () => void }) {
  const [value, setValue] = useState(group.max_daily_scheduled_messages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const res = await updateMaxDailyScheduled(group.id, value);
    setBusy(false);
    if (res.error) return setError(res.error);
    onSaved();
  }

  return (
    <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: 10, fontSize: 12 }}>
      {error && <p style={{ color: "#dc2626", marginBottom: 6 }}>{error}</p>}
      <label>
        এই গ্রুপে দিনে সর্বোচ্চ কতগুলো শিডিউলড অ্যানাউন্সমেন্ট/পোল যাবে (স্প্যামের মতো না লাগার জন্য)
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>
      <button disabled={busy} onClick={handleSave} style={{ width: "auto", marginTop: 6 }}>
        সেভ করুন
      </button>
    </div>
  );
}

function SpamFilterSettings({ initialBannedWords, initialBannedLinkPatterns }: { initialBannedWords: string[]; initialBannedLinkPatterns: string[] }) {
  const [wordsText, setWordsText] = useState(initialBannedWords.join(", "));
  const [linksText, setLinksText] = useState(initialBannedLinkPatterns.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const bannedWords = wordsText.split(",").map((w) => w.trim()).filter(Boolean);
    const bannedLinkPatterns = linksText.split(",").map((w) => w.trim()).filter(Boolean);
    const res = await updateGroupFilters(bannedWords, bannedLinkPatterns);
    setBusy(false);
    if (res.error) return setError(res.error);
    setSaved(true);
  }

  return (
    <div className="auth-card" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>স্প্যাম/ব্যানড-ওয়ার্ড ফিল্টার (সব গ্রুপে প্রযোজ্য)</h2>
      <p style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
        নিচের যেকোনো শব্দ/লিংক-প্যাটার্ন গ্রুপ মেসেজে মিললে — bot গ্রুপে অ্যাডমিন থাকলে অটোমেটিক ডিলিট হবে, না থাকলে
        ড্যাশবোর্ডে নোটিফিকেশন যাবে। কমা দিয়ে আলাদা করে লিখুন।
      </p>
      {error && <p style={{ color: "#dc2626", marginBottom: 8 }}>{error}</p>}
      <label>
        ব্যানড ওয়ার্ড
        <input type="text" value={wordsText} onChange={(e) => setWordsText(e.target.value)} placeholder="যেমন: গালি১, গালি২" style={{ width: "100%" }} />
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        ব্যানড লিংক প্যাটার্ন
        <input
          type="text"
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          placeholder="যেমন: bit.ly, t.me"
          style={{ width: "100%" }}
        />
      </label>
      <button disabled={busy} onClick={handleSave} style={{ marginTop: 8 }}>
        সেভ করুন
      </button>
      {saved && <span style={{ marginLeft: 8, color: "#166534", fontSize: 12 }}>✓ সেভ হয়েছে</span>}
    </div>
  );
}

export default function GroupsList({
  numbers,
  groups,
  initialBannedWords,
  initialBannedLinkPatterns,
}: {
  numbers: WhatsappNumber[];
  groups: Group[];
  initialBannedWords: string[];
  initialBannedLinkPatterns: string[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [welcomeOpenId, setWelcomeOpenId] = useState<string | null>(null);
  const [dailyLimitOpenId, setDailyLimitOpenId] = useState<string | null>(null);

  async function handleSync(numberId: string) {
    setBusyId(numberId);
    setError(null);
    const res = await syncGroups(numberId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleResyncWebhook(numberId: string) {
    setBusyId(`webhook-${numberId}`);
    setError(null);
    const res = await resyncWebhook(numberId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    alert("Webhook ইভেন্ট রিফ্রেশ হয়েছে — এখন থেকে নতুন মেম্বার জয়েন করলে ইভেন্ট পাওয়া যাবে।");
  }

  async function handleGetInvite(groupId: string) {
    setBusyId(groupId);
    setError(null);
    const res = await getInviteLink(groupId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleRotateInvite(groupId: string) {
    if (!confirm("ইনভাইট লিংক রোটেট করলে আগের লিংকটা আর কাজ করবে না। এগিয়ে যাবেন?")) return;
    setBusyId(groupId);
    setError(null);
    const res = await rotateInviteLink(groupId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleToggleAdminOnly(groupId: string, adminOnly: boolean) {
    setBusyId(groupId);
    setError(null);
    const res = await toggleAdminOnlyMode(groupId, adminOnly);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <div className="auth-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>নাম্বার থেকে সিঙ্ক</h2>
        {numbers.length === 0 && <p style={{ color: "#666", fontSize: 13 }}>এখনো কোনো WhatsApp নাম্বার কানেক্ট করা হয়নি।</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {numbers.map((n) => (
            <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{n.display_name}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={busyId === n.id} onClick={() => handleSync(n.id)} style={{ width: "auto" }}>
                  {busyId === n.id ? "সিঙ্ক হচ্ছে..." : "সিঙ্ক করুন"}
                </button>
                <button disabled={busyId === `webhook-${n.id}`} onClick={() => handleResyncWebhook(n.id)} style={{ width: "auto" }}>
                  Webhook ইভেন্ট রিফ্রেশ করুন
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SpamFilterSettings initialBannedWords={initialBannedWords} initialBannedLinkPatterns={initialBannedLinkPatterns} />

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>গ্রুপ লিস্ট</h2>
      {groups.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো গ্রুপ sync হয়নি।</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map((g) => {
          const adminCount = g.members.filter((m) => m.is_group_admin).length;
          return (
            <div key={g.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{g.name || "(নাম নেই)"}</strong>
                  <div style={{ color: "#666", marginTop: 2 }}>{g.number_name}</div>
                  {g.description && <div style={{ color: "#666", marginTop: 4 }}>{g.description}</div>}
                  <div style={{ color: "#999", marginTop: 4, fontSize: 12 }}>
                    {g.member_count} জন মেম্বার, {adminCount} জন অ্যাডমিন
                    {g.last_synced_at && ` — সর্বশেষ সিঙ্ক: ${new Date(g.last_synced_at).toLocaleString("bn-BD")}`}
                    {g.welcome_enabled && " — 👋 ওয়েলকাম চালু"}
                    {g.is_admin_only_mode && " — 🔒 Admin-only"}
                  </div>
                  {g.invite_code && (
                    <div style={{ marginTop: 6, fontSize: 12, wordBreak: "break-all", color: "#2563eb" }}>
                      https://chat.whatsapp.com/{g.invite_code}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    <button
                      onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                      style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0 }}
                    >
                      {expandedId === g.id ? "মেম্বার লুকান" : "মেম্বার দেখুন"}
                    </button>
                    <button
                      onClick={() => setWelcomeOpenId(welcomeOpenId === g.id ? null : g.id)}
                      style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0 }}
                    >
                      {welcomeOpenId === g.id ? "ওয়েলকাম সেটিংস লুকান" : "ওয়েলকাম সেটিংস"}
                    </button>
                    <button
                      onClick={() => setDailyLimitOpenId(dailyLimitOpenId === g.id ? null : g.id)}
                      style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0 }}
                    >
                      {dailyLimitOpenId === g.id ? "দৈনিক লিমিট লুকান" : `দৈনিক শিডিউল লিমিট (${g.max_daily_scheduled_messages})`}
                    </button>
                  </div>
                  {expandedId === g.id && (
                    <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: 8, fontSize: 11 }}>
                      {g.members.length === 0 && <p>কোনো মেম্বার নেই (সিঙ্ক করা লাগতে পারে)।</p>}
                      {g.members.map((m) => (
                        <div key={m.phone}>
                          {m.name || m.phone} {m.is_group_admin && "👑"}
                        </div>
                      ))}
                    </div>
                  )}
                  {welcomeOpenId === g.id && <WelcomeSettingsForm group={g} onSaved={() => router.refresh()} />}
                  {dailyLimitOpenId === g.id && <MaxDailyScheduledForm group={g} onSaved={() => router.refresh()} />}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <Link href={`/dashboard/groups/${g.id}/keywords`} style={{ fontSize: 13 }}>
                    কিওয়ার্ড রিপ্লাই →
                  </Link>
                  <Link href={`/dashboard/groups/${g.id}/messages`} style={{ fontSize: 13 }}>
                    মেসেজ আর্কাইভ →
                  </Link>
                  <button disabled={busyId === g.id} onClick={() => handleGetInvite(g.id)} style={{ width: "auto" }}>
                    ইনভাইট লিংক আনুন
                  </button>
                  {g.invite_code && (
                    <button disabled={busyId === g.id} onClick={() => handleRotateInvite(g.id)} style={{ width: "auto", color: "#dc2626" }}>
                      রোটেট করুন
                    </button>
                  )}
                  <button disabled={busyId === g.id} onClick={() => handleToggleAdminOnly(g.id, !g.is_admin_only_mode)} style={{ width: "auto" }}>
                    {g.is_admin_only_mode ? "সবাই পোস্ট করতে পারবে" : "শুধু Admin পোস্ট করবে"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
