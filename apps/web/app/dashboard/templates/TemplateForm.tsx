"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { formatWhatsAppPreviewHtml } from "@whatsapp-saas/core/templates/format-preview";
import { Card, Input, Textarea, Button } from "@/components/ui";
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
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
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
    <div className="flex flex-col gap-6 lg:flex-row">
      <Card className="flex-1">
        <h1 className="mb-4 text-base font-semibold text-text">{mode === "create" ? "নতুন টেমপ্লেট" : "টেমপ্লেট এডিট"}</h1>
        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input id="name" name="name" type="text" required label="নাম" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            id="category"
            name="category"
            type="text"
            label="ক্যাটাগরি (ঐচ্ছিক)"
            placeholder="যেমন: ঈদ, সেল"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <div>
            <Textarea
              id="content"
              name="content"
              label="মেসেজ"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="যেমন: {{name|ভাই}}, {আসসালামু আলাইকুম|হ্যালো}! *ঈদ অফার* চলছে..."
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {variableSuggestions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => insertVariable(key)}
                  className="rounded-full border border-border bg-app-bg px-2.5 py-1 text-xs text-text-muted hover:bg-gray-100"
                >
                  {"{{" + key + "}}"}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-text">ছবি বা PDF (ঐচ্ছিক)</span>
            <input
              id="media"
              name="media"
              type="file"
              accept="image/*,.pdf"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-primary"
            />
            {initial?.media_url && <span className="mt-1 block text-xs text-text-muted">আগের ফাইল আছে ({initial.media_type}), নতুন দিলে বদলে যাবে</span>}
          </label>

          <Button type="submit" loading={loading}>
            {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </form>

        <Button variant="secondary" onClick={handleCheckCoverage} disabled={checkingCoverage} className="mt-3">
          {checkingCoverage ? "চেক হচ্ছে..." : "ভেরিয়েবল চেক করুন"}
        </Button>

        {coverage && coverage.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {coverage.map((c) => (
              <span key={c.key} className={`flex items-center gap-1.5 ${c.missingCount > 0 ? "text-warning" : "text-success"}`}>
                {c.missingCount > 0 ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {c.missingCount > 0
                  ? `{{${c.key}}} — ${c.totalContacts} জনের মধ্যে ${c.missingCount} জনের এই তথ্য নেই`
                  : `{{${c.key}}} — সবার আছে`}
              </span>
            ))}
          </div>
        )}

        {mode === "edit" && (
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="mt-4 w-full">
            ডিলিট করুন
          </Button>
        )}
      </Card>

      <Card className="flex-1 self-start">
        <p className="mb-3 text-sm font-semibold text-text">প্রিভিউ</p>
        <div
          className="min-h-[120px] rounded-lg bg-[#dcf8c6] p-4 text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: previewHtml || "<span style='color:#888'>প্রিভিউ এখানে দেখাবে</span>" }}
        />
        <button
          type="button"
          onClick={() => setPreviewSeed((s) => s + 1)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" /> আবার দেখুন (নতুন spintax)
        </button>
        <p className="mt-3 text-xs text-text-muted">
          নমুনা কন্টাক্ট: {sampleContact.name ?? "(নাম নেই)"} · {sampleContact.phone}
        </p>
      </Card>
    </div>
  );
}
