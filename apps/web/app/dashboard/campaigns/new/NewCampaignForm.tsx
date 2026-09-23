"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "./actions";

interface Props {
  templates: { id: string; name: string }[];
  numbers: { id: string; display_name: string | null; status: string }[];
}

export default function NewCampaignForm({ templates, numbers }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!scheduleLater) formData.delete("scheduledAt");

    setLoading(true);
    setError(null);
    const result = await createCampaign(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/campaigns/${result.id}`);
  }

  if (templates.length === 0) {
    return (
      <div className="auth-card" style={{ margin: "0 auto" }}>
        <p>প্রথমে একটা টেমপ্লেট বানান।</p>
      </div>
    );
  }
  if (numbers.length === 0) {
    return (
      <div className="auth-card" style={{ margin: "0 auto" }}>
        <p>অনলাইন কোনো WhatsApp নাম্বার নেই। আগে একটা নাম্বার কানেক্ট করুন।</p>
      </div>
    );
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>নতুন ক্যাম্পেইন</h1>
      {error && <div className="error">{error}</div>}

      <form action={handleSubmit}>
        <label htmlFor="name">ক্যাম্পেইনের নাম</label>
        <input id="name" name="name" type="text" required placeholder="যেমন: ঈদ অফার সেপ্টেম্বর" />

        <label htmlFor="templateId">টেমপ্লেট</label>
        <select id="templateId" name="templateId" required style={selectStyle}>
          <option value="">বাছাই করুন</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="numberId">নাম্বার</label>
        <select id="numberId" name="numberId" required style={selectStyle}>
          <option value="">বাছাই করুন</option>
          {numbers.map((n) => (
            <option key={n.id} value={n.id}>
              {n.display_name ?? n.id}
            </option>
          ))}
        </select>

        <label htmlFor="audienceTag">অডিয়েন্স</label>
        <input id="audienceTag" name="audienceTag" type="text" placeholder="ফাঁকা রাখলে সব কন্টাক্ট, নাহলে ট্যাগের নাম দিন" />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={scheduleLater} onChange={(e) => setScheduleLater(e.target.checked)} />
          পরে পাঠান (শিডিউল)
        </label>

        {scheduleLater && (
          <>
            <label htmlFor="scheduledAt">কখন পাঠাবে</label>
            <input id="scheduledAt" name="scheduledAt" type="datetime-local" />
          </>
        )}

        <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
          {loading ? "তৈরি হচ্ছে..." : scheduleLater ? "শিডিউল করুন" : "এখনই পাঠান"}
        </button>
      </form>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
  marginBottom: 16,
};
