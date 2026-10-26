"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { renderEmailTemplate } from "@whatsapp-saas/core/email/render";
import { appendEmailFooter } from "@whatsapp-saas/core/email/compose";
import { htmlToText, stripDangerousHtml } from "@whatsapp-saas/core/email/html";
import { EMAIL_HTML_WARN } from "@whatsapp-saas/core/email/validate-template";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { saveEmailTemplate, deleteEmailTemplate } from "./actions";

type Field = "subject" | "html" | "text";

interface Props {
  mode: "create" | "edit";
  templateId?: string;
  initial?: { name: string; category: string; subject: string; preheader: string; bodyHtml: string; bodyText: string };
  sampleContact: { email: string; name: string | null; custom_fields: Record<string, string> };
  variableSuggestions: string[];
  footer: { businessName: string; postalAddress: string };
}

const STARTER_HTML = `<p>আসসালামু আলাইকুম {{name|ভাই}},</p>\n<p>এখানে আপনার বার্তা লিখুন।</p>\n<p>ধন্যবাদ।</p>`;

// সরল টেমপ্লেট এডিটর: সাবজেক্ট + HTML + plain text, ভেরিয়েবল চিপ, আর পাঠানোর আগে প্রিভিউ।
// প্রিভিউ sandbox করা iframe এ (স্ক্রিপ্ট চলে না) এবং সিস্টেম ফুটার সহ — সেই ফুটার আর আনসাবস্ক্রাইব
// লিংক প্রতিটা ইমেইলে নিজে যোগ হয়, এখান থেকে সরানো যায় না।
export default function EmailTemplateForm({ mode, templateId, initial, sampleContact, variableSuggestions, footer }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [preheader, setPreheader] = useState(initial?.preheader ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? (mode === "create" ? STARTER_HTML : ""));
  const [bodyText, setBodyText] = useState(initial?.bodyText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");
  const [mobileWidth, setMobileWidth] = useState(false);
  const [activeField, setActiveField] = useState<Field>("html");

  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // সেভের সময় সার্ভার যেটা রাখবে (বিপজ্জনক ট্যাগ ছাঁটা) প্রিভিউও সেটাই দেখায়
  const preview = useMemo(() => {
    const rendered = renderEmailTemplate(
      { subject, preheader, body_html: stripDangerousHtml(bodyHtml), body_text: bodyText },
      sampleContact
    );
    const withFooter = appendEmailFooter({
      html: rendered.html,
      text: rendered.text,
      urls: { pageUrl: "#", oneClickUrl: "#" },
      businessName: footer.businessName,
      postalAddress: footer.postalAddress,
    });
    return { subject: rendered.subject, html: withFooter.html, text: withFooter.text };
  }, [subject, preheader, bodyHtml, bodyText, sampleContact, footer]);

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const target =
      activeField === "subject"
        ? { ref: subjectRef.current, value: subject, set: setSubject }
        : activeField === "text"
          ? { ref: textRef.current, value: bodyText, set: setBodyText }
          : { ref: htmlRef.current, value: bodyHtml, set: setBodyHtml };

    const start = target.ref?.selectionStart ?? target.value.length;
    const end = target.ref?.selectionEnd ?? target.value.length;
    target.set(target.value.slice(0, start) + token + target.value.slice(end));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await saveEmailTemplate(mode === "edit" ? templateId! : null, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/email/templates");
  }

  async function handleDelete() {
    if (!templateId || !confirm("এই টেমপ্লেট ডিলিট করবেন?")) return;
    setDeleting(true);
    const result = await deleteEmailTemplate(templateId);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/email/templates");
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <Card className="flex-1">
        <h1 className="mb-4 text-base font-semibold text-text">{mode === "create" ? "নতুন ইমেইল টেমপ্লেট" : "ইমেইল টেমপ্লেট এডিট"}</h1>
        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="name" label="টেমপ্লেটের নাম (শুধু আপনার জন্য)" required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <Input name="category" label="ক্যাটাগরি (ঐচ্ছিক)" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />

          <Input
            ref={subjectRef}
            name="subject"
            label="সাবজেক্ট"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setActiveField("subject")}
            maxLength={300}
            placeholder="যেমন: {{name|ভাই}}, আপনার জন্য বিশেষ অফার"
          />
          <Input
            name="preheader"
            label="প্রিহেডার (ঐচ্ছিক) — ইনবক্সে সাবজেক্টের পাশে দেখানো ছোট লেখা"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            maxLength={200}
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-text">ভেরিয়েবল যোগ করুন (যে ঘরে কার্সার আছে সেখানে বসবে)</p>
            <div className="flex flex-wrap gap-1.5">
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

          <div>
            <Textarea
              ref={htmlRef}
              name="bodyHtml"
              label="ইমেইলের বডি (HTML)"
              required
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              onFocus={() => setActiveField("html")}
              rows={14}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <p className={`mt-1 flex items-center gap-1 text-xs ${bodyHtml.length > EMAIL_HTML_WARN ? "text-warning" : "text-text-muted"}`}>
              {bodyHtml.length > EMAIL_HTML_WARN && <AlertTriangle className="h-3.5 w-3.5" />}
              {bodyHtml.length.toLocaleString("en-US")} অক্ষর
              {bodyHtml.length > EMAIL_HTML_WARN ? " — Gmail প্রায় ১০২KB এর বেশি HTML কেটে দেয়, ছোট করুন" : ""}
            </p>
          </div>

          <div>
            <Textarea
              ref={textRef}
              name="bodyText"
              label="Plain text সংস্করণ (ঐচ্ছিক)"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              onFocus={() => setActiveField("text")}
              rows={6}
              helperText="ফাঁকা রাখলে পাঠানোর সময় HTML থেকে নিজে বানানো হবে। স্প্যাম-ফিল্টার এড়াতে plain text থাকা ভালো।"
            />
            <button
              type="button"
              onClick={() => setBodyText(htmlToText(bodyHtml))}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              HTML থেকে plain text তৈরি করুন
            </button>
          </div>

          <Button type="submit" loading={loading}>
            {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </form>

        {mode === "edit" && (
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="mt-4 w-full">
            ডিলিট করুন
          </Button>
        )}
      </Card>

      <Card className="flex-1 self-start">
        <p className="mb-2 text-sm font-semibold text-text">প্রিভিউ</p>
        <p className="mb-3 rounded-lg bg-app-bg px-3 py-2 text-sm text-text">
          <span className="text-text-muted">সাবজেক্ট: </span>
          {preview.subject || <span className="text-text-muted">—</span>}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPreviewTab("html")}
            className={`rounded-full border px-3 py-1 ${previewTab === "html" ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted"}`}
          >
            HTML
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab("text")}
            className={`rounded-full border px-3 py-1 ${previewTab === "text" ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted"}`}
          >
            Plain text
          </button>
          {previewTab === "html" && (
            <button type="button" onClick={() => setMobileWidth((v) => !v)} className="ml-auto text-primary hover:underline">
              {mobileWidth ? "ডেস্কটপ প্রস্থ" : "মোবাইল প্রস্থ"}
            </button>
          )}
        </div>

        {previewTab === "html" ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            {/* sandbox="" — স্ক্রিপ্ট, ফর্ম, টপ-নেভিগেশন সব বন্ধ */}
            <iframe
              title="ইমেইল প্রিভিউ"
              sandbox=""
              srcDoc={preview.html}
              className="h-[460px] border-0"
              style={{ width: mobileWidth ? 375 : "100%" }}
            />
          </div>
        ) : (
          <pre className="max-h-[460px] overflow-auto rounded-lg border border-border bg-white p-3 text-xs whitespace-pre-wrap text-text">{preview.text}</pre>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-xs text-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ইমেইলের শেষে আনসাবস্ক্রাইব লিংক, ব্যবসার নাম ও ঠিকানাসহ ফুটার প্রতিটা ইমেইলে নিজে থেকে যোগ হয় এবং সরানো যায় না। এছাড়া হেডারে one-click আনসাবস্ক্রাইবও যোগ হয়।
        </p>
        <p className="mt-1 text-xs text-text-muted">নমুনা কন্টাক্ট: {sampleContact.name ?? "(নাম নেই)"} · {sampleContact.email}</p>
      </Card>
    </div>
  );
}
