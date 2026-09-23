"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { formatWhatsAppPreviewHtml } from "@whatsapp-saas/core/templates/format-preview";
import { createTemplate, updateTemplate, deleteTemplate, checkVariableCoverage, type VariableCoverage } from "./actions";

type SampleContact = { name: string | null; phone: string; custom_fields: Record<string, string> };

interface Props {
  mode: "create" | "edit";
  templateId?: string;
  initial?: {
    name: string;
    category: string | null;
    content: string;
    media_url: string | null;
    media_type: string | null;
  };
  sampleContact: SampleContact;
  variableSuggestions: string[];
}

export default function TemplateForm({ mode, templateId, initial, sampleContact, variableSuggestions }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [previewSeed, setPreviewSeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverage, setCoverage] = useState<VariableCoverage[] | null>(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewHtml = useMemo(() => {
    const rendered = renderMessage(content, sampleContact);
    return formatWhatsAppPreviewHtml(rendered);
  }, [content, sampleContact, previewSeed]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result =
      mode === "create" ? await createTemplate(formData) : await updateTemplate(templateId!, formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/templates");
  }

  async function handleDelete() {
    if (!templateId) return;
    if (!confirm("এই টেমপ্লেট ডিলিট করবেন?")) return;
    await deleteTemplate(templateId);
    router.push("/dashboard/templates");
  }

  async function handleCheckCoverage() {
    setCheckingCoverage(true);
    const result = await checkVariableCoverage(content);
    setCheckingCoverage(false);
    if (!result.error) setCoverage(result.coverage);
  }

  function insertVariable(key: string) {
    setContent((c) => `${c}{{${key}}}`);
  }

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 900 }}>
      <div className="auth-card" style={{ margin: 0, flex: 1 }}>
        <h1>{mode === "create" ? "নতুন টেমপ্লেট" : "টেমপ্লেট এডিট"}</h1>
        {error && <div className="error">{error}</div>}

        <form action={handleSubmit}>
          <label htmlFor="name">নাম</label>
          <input id="name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

          <label htmlFor="category">ক্যাটাগরি (ঐচ্ছিক)</label>
          <input id="category" name="category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="যেমন: ঈদ, সেল" />

          <label htmlFor="content">মেসেজ</label>
          <textarea
            id="content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginBottom: 8, fontFamily: "inherit" }}
            placeholder="যেমন: {{name|ভাই}}, {আসসালামু আলাইকুম|হ্যালো}! *ঈদ অফার* চলছে..."
          />

          <div style={{ marginBottom: 16 }}>
            {variableSuggestions.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => insertVariable(key)}
                style={{ fontSize: 12, padding: "3px 8px", marginRight: 6, marginBottom: 6, borderRadius: 999, border: "1px solid #ddd", background: "#f7f7f8", cursor: "pointer" }}
              >
                {"{{" + key + "}}"}
              </button>
            ))}
          </div>

          <label htmlFor="media">ছবি বা PDF (ঐচ্ছিক)</label>
          <input id="media" name="media" type="file" accept="image/*,.pdf" />
          {initial?.media_url && (
            <p style={{ fontSize: 12, color: "#666" }}>
              আগের ফাইল আছে ({initial.media_type}), নতুন দিলে বদলে যাবে
            </p>
          )}

          <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </form>

        <button type="button" onClick={handleCheckCoverage} disabled={checkingCoverage} style={{ marginTop: 12, background: "#eee", color: "#333" }}>
          {checkingCoverage ? "চেক হচ্ছে..." : "ভেরিয়েবল চেক করুন"}
        </button>

        {coverage && coverage.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {coverage.map((c) => (
              <div key={c.key} style={{ color: c.missingCount > 0 ? "#b45309" : "#166534" }}>
                {c.missingCount > 0
                  ? `⚠️ {{${c.key}}} — ${c.totalContacts} জনের মধ্যে ${c.missingCount} জনের এই তথ্য নেই`
                  : `✅ {{${c.key}}} — সবার আছে`}
              </div>
            ))}
          </div>
        )}

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            style={{ marginTop: 16, background: "white", color: "#dc2626", border: "1px solid #dc2626" }}
          >
            ডিলিট করুন
          </button>
        )}
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
          dangerouslySetInnerHTML={{ __html: previewHtml || "<span style='color:#888'>প্রিভিউ এখানে দেখাবে</span>" }}
        />
        <button
          type="button"
          onClick={() => setPreviewSeed((s) => s + 1)}
          style={{ marginTop: 8, fontSize: 13, background: "#eee", color: "#333" }}
        >
          আবার দেখুন (নতুন spintax)
        </button>
        <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          নমুনা কন্টাক্ট: {sampleContact.name ?? "(নাম নেই)"} · {sampleContact.phone}
        </p>
      </div>
    </div>
  );
}
