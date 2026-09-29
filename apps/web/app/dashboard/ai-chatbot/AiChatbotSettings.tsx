"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Upload, Trash2, RotateCcw, ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import { Card, Input, Select, Textarea, Button, Badge, EmptyState } from "@/components/ui";
import { saveAiSettings, setApiKey, uploadDocument, reprocessDocument, deleteDocument, getDocumentChunks } from "./actions";

type Settings = {
  llm_provider: string | null;
  system_prompt: string | null;
  support_phone: string | null;
  typical_delivery_time: string | null;
  api_key_secret_id: string | null;
} | null;

type Doc = {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  pending: "অপেক্ষায়",
  processing: "প্রসেস হচ্ছে...",
  ready: "রেডি",
  failed: "ব্যর্থ",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "neutral",
  processing: "info",
  ready: "success",
  failed: "danger",
};

export default function AiChatbotSettings({
  settings,
  documents,
  totalReadyWords,
  fullTextModeMaxWords,
}: {
  settings: Settings;
  documents: Doc[];
  totalReadyWords: number;
  fullTextModeMaxWords: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [chunksByDoc, setChunksByDoc] = useState<Record<string, { id: string; content: string }[]>>({});

  async function toggleChunks(docId: string) {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(docId);
    if (!chunksByDoc[docId]) {
      const chunks = await getDocumentChunks(docId);
      setChunksByDoc((prev) => ({ ...prev, [docId]: chunks }));
    }
  }

  async function handleSaveSettings(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await saveAiSettings(formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleSetApiKey(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await setApiKey(formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    if (apiKeyInputRef.current) apiKeyInputRef.current.value = "";
    router.refresh();
  }

  async function handleUpload(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await uploadDocument(formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleReprocess(id: string) {
    setBusy(true);
    await reprocessDocument(id);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("এই ডকুমেন্টটা মুছে ফেলবেন?")) return;
    setBusy(true);
    await deleteDocument(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[850px] flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-text">এআই চ্যাটবট</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          কোনো hardcoded rule নেই — System Prompt-ই একমাত্র নিয়ন্ত্রক: বট কী জানলে কী উত্তর দেবে, না জানলে কীভাবে
          ভদ্রভাবে বলবে, কীভাবে অর্ডার নেবে, সবকিছু এখানেই লিখে দিন। নাম্বার পেজ থেকে প্রতিটা নাম্বারে আলাদাভাবে বট
          অন/অফ করা যায়।
        </p>
        <p className="mt-1 text-[13px] text-text-muted">
          API key খরচ আপনার workspace বহন করবে (আপনার নিজের OpenAI/Gemini অ্যাকাউন্ট থেকে)।
        </p>
        <p className={`mt-2 text-xs ${totalReadyWords > fullTextModeMaxWords ? "text-warning" : "text-success"}`}>
          মোট {totalReadyWords.toLocaleString("bn-BD")} শব্দ (রেডি ডকুমেন্ট মিলিয়ে) —{" "}
          {totalReadyWords > fullTextModeMaxWords ? "খোঁজা-ভিত্তিক (chunk retrieval) মোডে চলছে" : "পুরো-টেক্সট এজেন্ট মোডে চলছে"}
        </p>
      </div>

      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      {/* API Key */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-text-muted" />
          <p className="text-sm font-semibold text-text">API Key</p>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          {settings?.api_key_secret_id ? "একটা key সেট করা আছে (নিরাপত্তার জন্য দেখানো হয় না)।" : "এখনো কোনো key সেট করা নেই।"}
        </p>
        <form action={handleSetApiKey} className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={apiKeyInputRef}
            type="password"
            name="apiKey"
            placeholder="sk-... বা AIza..."
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" disabled={busy}>
            {settings?.api_key_secret_id ? "বদলান" : "সেভ করুন"}
          </Button>
        </form>
      </Card>

      {/* ইনস্ট্রাকশন / সিস্টেম প্রম্পট */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-text">ইনস্ট্রাকশন / সিস্টেম প্রম্পট</p>
        <form action={handleSaveSettings} className="flex flex-col gap-4">
          <Select name="llmProvider" label="LLM Provider" defaultValue={settings?.llm_provider ?? "openai"}>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </Select>

          <Textarea
            name="systemPrompt"
            label="System Prompt (বট কীভাবে কথা বলবে, কী টোনে, কী সীমার মধ্যে থেকে উত্তর দেবে)"
            defaultValue={settings?.system_prompt ?? ""}
            rows={8}
            className="min-h-[200px]"
            placeholder="যেমন: তুমি একটা কাপড়ের দোকানের সহকারী। বাংলায় ভদ্রভাবে সংক্ষিপ্ত উত্তর দাও। দাম নিয়ে অনিশ্চিত হলে সরাসরি বলে দাও যে নিশ্চিত না।"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              name="supportPhone"
              label="সাপোর্ট নাম্বার (ঐচ্ছিক)"
              defaultValue={settings?.support_phone ?? ""}
              placeholder="01XXXXXXXXX"
              helperText="AI-এর প্রকৃত টেকনিক্যাল সমস্যা হলে (key ভুল, quota শেষ) এই নাম্বারসহ একটা safety-net মেসেজ যাবে"
            />
            <Input
              name="typicalDeliveryTime"
              label="সাধারণ ডেলিভারি সময় (ঐচ্ছিক)"
              defaultValue={settings?.typical_delivery_time ?? ""}
              placeholder="যেমন: ৩-৫ কর্মদিবস"
              helperText='কাস্টমার "কবে পাবো?" জিজ্ঞেস করলে এই তথ্য দিয়ে উত্তর দেবে'
            />
          </div>

          <Button type="submit" disabled={busy} className="self-start">
            সেভ করুন
          </Button>
        </form>
      </Card>

      {/* Knowledge base */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-text">নলেজ বেস ডকুমেন্ট</p>

        {documents.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="এখনো কোনো ফাইল আপলোড হয়নি" />
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            {documents.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">
                      {d.file_name} <span className="text-xs font-normal text-text-muted">({d.file_type.toUpperCase()})</span>
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant={statusVariant[d.status] ?? "neutral"}>{statusLabel[d.status] ?? d.status}</Badge>
                      {d.error_message && <span className="text-xs text-danger">{d.error_message}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {d.status === "ready" && (
                      <button
                        disabled={busy}
                        onClick={() => toggleChunks(d.id)}
                        title="AI যেভাবে ডকুমেন্টটা ছোট ছোট অংশে ভেঙে পড়ে সেটা দেখুন"
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-gray-50"
                      >
                        ডকুমেন্টের অংশ দেখুন {expandedDocId === d.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {d.status === "failed" && (
                      <button
                        disabled={busy}
                        onClick={() => handleReprocess(d.id)}
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-gray-50"
                        aria-label="আবার চেষ্টা করুন"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => handleDelete(d.id)}
                      className="flex items-center gap-1 rounded-lg border border-danger-light px-2 py-1.5 text-xs text-danger hover:bg-danger-light"
                      aria-label="মুছুন"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {expandedDocId === d.id && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    {!chunksByDoc[d.id] && <p className="text-xs text-text-muted">লোড হচ্ছে...</p>}
                    {chunksByDoc[d.id]?.length === 0 && <p className="text-xs text-text-muted">কোনো chunk নেই।</p>}
                    {chunksByDoc[d.id]?.map((c, i) => (
                      <div key={c.id} className="rounded-lg bg-app-bg p-2 text-xs">
                        <p className="mb-1 text-text-muted">অংশ {i + 1}</p>
                        <p className="whitespace-pre-wrap text-text">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form action={handleUpload} className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="mb-1.5 block font-medium text-text">নতুন ফাইল আপলোড (PDF, XLSX, CSV, TXT — সর্বোচ্চ 10MB)</span>
            <input
              type="file"
              name="file"
              accept=".pdf,.xlsx,.xls,.csv,.txt"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-primary"
            />
          </label>
          <Button type="submit" disabled={busy}>
            <Upload className="h-4 w-4" /> আপলোড করুন
          </Button>
        </form>
      </Card>
    </div>
  );
}
