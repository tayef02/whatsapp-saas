"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncGroups, getInviteLink, rotateInviteLink } from "./actions";

type Member = { phone: string; name: string | null; is_group_admin: boolean };
type Group = {
  id: string;
  name: string | null;
  description: string | null;
  member_count: number;
  invite_code: string | null;
  last_synced_at: string | null;
  number_name: string | null;
  members: Member[];
};
type WhatsappNumber = { id: string; display_name: string };

export default function GroupsList({ numbers, groups }: { numbers: WhatsappNumber[]; groups: Group[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSync(numberId: string) {
    setBusyId(numberId);
    setError(null);
    const res = await syncGroups(numberId);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
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
              <button disabled={busyId === n.id} onClick={() => handleSync(n.id)} style={{ width: "auto" }}>
                {busyId === n.id ? "সিঙ্ক হচ্ছে..." : "সিঙ্ক করুন"}
              </button>
            </div>
          ))}
        </div>
      </div>

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
                  </div>
                  {g.invite_code && (
                    <div style={{ marginTop: 6, fontSize: 12, wordBreak: "break-all", color: "#2563eb" }}>
                      https://chat.whatsapp.com/{g.invite_code}
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                    style={{ width: "auto", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 11, padding: 0, marginTop: 6 }}
                  >
                    {expandedId === g.id ? "মেম্বার লুকান" : "মেম্বার দেখুন"}
                  </button>
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
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <Link href={`/dashboard/groups/${g.id}/keywords`} style={{ fontSize: 13 }}>
                    কিওয়ার্ড রিপ্লাই →
                  </Link>
                  <button disabled={busyId === g.id} onClick={() => handleGetInvite(g.id)} style={{ width: "auto" }}>
                    ইনভাইট লিংক আনুন
                  </button>
                  {g.invite_code && (
                    <button disabled={busyId === g.id} onClick={() => handleRotateInvite(g.id)} style={{ width: "auto", color: "#dc2626" }}>
                      রোটেট করুন
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
