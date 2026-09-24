"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { formatWhatsAppPreviewHtml } from "@whatsapp-saas/core/templates/format-preview";
import { createCampaign, getAudienceCount } from "./actions";

type SampleContact = { name: string | null; phone: string; custom_fields: Record<string, string> };

interface Props {
  templates: { id: string; name: string; content: string }[];
  numbers: { id: string; display_name: string | null; status: string; min_delay_seconds: number; max_delay_seconds: number }[];
  sampleContact: SampleContact;
}

export default function NewCampaignForm({ templates, numbers, sampleContact }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [numberId, setNumberId] = useState("");
  const [audienceTag, setAudienceTag] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    const rendered = renderMessage(selectedTemplate.content, sampleContact);
    return formatWhatsAppPreviewHtml(rendered);
  }, [selectedTemplate, sampleContact]);

  function handleNumberChange(id: string) {
    setNumberId(id);
    const number = numbers.find((n) => n.id === id);
    if (number) {
      setMinDelay(number.min_delay_seconds);
      setMaxDelay(number.max_delay_seconds);
    }
  }

  // ট্যাগ লেখার সাথে সাথে (একটু দেরি করে) কতজন কন্টাক্ট পাবে দেখানো
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const count = await getAudienceCount(audienceTag.trim() || null);
      setAudienceCount(count);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [audienceTag]);

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
    <div style={{ display: "flex", gap: 24, maxWidth: 900 }}>
      <div className="auth-card" style={{ margin: 0, flex: 1 }}>
        <h1>নতুন ক্যাম্পেইন</h1>
        {error && <div className="error">{error}</div>}

        <form action={handleSubmit}>
          <label htmlFor="name">ক্যাম্পেইনের নাম</label>
          <input id="name" name="name" type="text" required placeholder="যেমন: ঈদ অফার সেপ্টেম্বর" />

          <label htmlFor="templateId">টেমপ্লেট</label>
          <select
            id="templateId"
            name="templateId"
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={selectStyle}
          >
            <option value="">বাছাই করুন</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label htmlFor="numberId">নাম্বার</label>
          <select
            id="numberId"
            name="numberId"
            required
            value={numberId}
            onChange={(e) => handleNumberChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">বাছাই করুন</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.display_name ?? n.id}
              </option>
            ))}
          </select>

          {numberId && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="minDelay">ন্যূনতম ডিলে (সেকেন্ড)</label>
                <input
                  id="minDelay"
                  name="minDelay"
                  type="number"
                  min={1}
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="maxDelay">সর্বোচ্চ ডিলে (সেকেন্ড)</label>
                <input
                  id="maxDelay"
                  name="maxDelay"
                  type="number"
                  min={1}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          {numberId && (
            <p style={{ fontSize: 12, color: "#666", marginTop: -8 }}>
              এই ডিলে এই নাম্বারের সব ক্যাম্পেইনে প্রযোজ্য হবে (নাম্বার-ভিত্তিক, শুধু এই ক্যাম্পেইনের জন্য না)
            </p>
          )}

          <label htmlFor="audienceTag">অডিয়েন্স</label>
          <input
            id="audienceTag"
            name="audienceTag"
            type="text"
            value={audienceTag}
            onChange={(e) => setAudienceTag(e.target.value)}
            placeholder="ফাঁকা রাখলে সব কন্টাক্ট, নাহলে ট্যাগের নাম দিন"
          />
          {audienceCount !== null && (
            <p style={{ fontSize: 13, color: "#166534", marginTop: -8 }}>
              {audienceCount} জন কন্টাক্ট পাবে (opt-out বাদে)
            </p>
          )}

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

      <div style={{ flex: 1 }}>
        <div
          style={{
            background: "#dcf8c6",
            borderRadius: 8,
            padding: 16,
            minHeight: 120,
            fontSize: 14,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{
            __html: previewHtml || "<span style='color:#888'>টেমপ্লেট বাছাই করলে প্রিভিউ দেখাবে</span>",
          }}
        />
        <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          নমুনা কন্টাক্ট: {sampleContact.name ?? "(নাম নেই)"} · {sampleContact.phone}
        </p>
      </div>
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
