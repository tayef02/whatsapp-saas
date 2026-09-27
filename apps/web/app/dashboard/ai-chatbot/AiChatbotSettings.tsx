"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveAiSettings, setApiKey, uploadDocument, reprocessDocument, deleteDocument, getDocumentChunks } from "./actions";

type Settings = {
  llm_provider: string | null;
  system_prompt: string | null;
  confidence_threshold: number;
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
  ready: "✅ রেডি",
  failed: "❌ ব্যর্থ",
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
    <div>
      <h1>AI Chatbot (Knowledge Base)</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
        কাস্টমারের প্রতিটা মেসেজে AI আপনার আপলোড করা ডকুমেন্ট দেখে উত্তর দেয়। ডকুমেন্ট ছোট/মাঝারি
        হলে ({fullTextModeMaxWords.toLocaleString("bn-BD")} শব্দের মধ্যে) পুরো টেক্সট সরাসরি AI-কে
        দেওয়া হয় — একজন এজেন্টের মতো পুরো শীট পড়ে যেকোনো ধরনের প্রশ্নের উত্তর বুঝে দিতে পারে। এর
        বেশি বড় হলে শুধু প্রাসঙ্গিক অংশ খুঁজে ব্যবহার করা হয়। কোনো উত্তর না পেলে এজেন্টের কাছে চলে
        যাবে। API key খরচ আপনার workspace বহন করবে (আপনার নিজের OpenAI/Gemini অ্যাকাউন্ট থেকে)।
      </p>
      <p style={{ fontSize: 12, color: totalReadyWords > fullTextModeMaxWords ? "#b45309" : "#166534", marginBottom: 20 }}>
        মোট {totalReadyWords.toLocaleString("bn-BD")} শব্দ (রেডি ডকুমেন্ট মিলিয়ে) —{" "}
        {totalReadyWords > fullTextModeMaxWords
          ? "খোঁজা-ভিত্তিক (chunk retrieval) মোডে চলছে"
          : "পুরো-টেক্সট এজেন্ট মোডে চলছে"}
      </p>

      {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

      <div className="auth-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>API Key</h2>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          {settings?.api_key_secret_id ? "✅ একটা key সেট করা আছে (নিরাপত্তার জন্য দেখানো হয় না)।" : "এখনো কোনো key সেট করা নেই।"}
        </p>
        <form action={handleSetApiKey} style={{ display: "flex", gap: 8 }}>
          <input ref={apiKeyInputRef} type="password" name="apiKey" placeholder="sk-... বা AIza..." style={{ flex: 1 }} />
          <button type="submit" disabled={busy} style={{ width: "auto", flex: "0 0 auto" }}>
            {settings?.api_key_secret_id ? "বদলান" : "সেভ করুন"}
          </button>
        </form>
      </div>

      <form action={handleSaveSettings} className="auth-card" style={{ marginBottom: 24 }}>
        <label>
          LLM Provider
          <select name="llmProvider" defaultValue={settings?.llm_provider ?? "openai"} style={{ width: "100%" }}>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          System Prompt (বট কীভাবে কথা বলবে, কী টোনে, কী সীমার মধ্যে থেকে উত্তর দেবে)
          <textarea
            name="systemPrompt"
            defaultValue={settings?.system_prompt ?? ""}
            rows={4}
            placeholder="যেমন: তুমি একটা কাপড়ের দোকানের সহকারী। বাংলায় ভদ্রভাবে সংক্ষিপ্ত উত্তর দাও। দাম নিয়ে অনিশ্চিত হলে সরাসরি বলে দাও যে নিশ্চিত না।"
            style={{ width: "100%" }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Confidence Threshold ({settings?.confidence_threshold ?? 0.5}) — শুধু বড় knowledge base
          (খোঁজা-ভিত্তিক মোড) এর জন্য প্রযোজ্য। বেশি হলে কম ক্ষেত্রে AI উত্তর দেবে, কম হলে বেশি ক্ষেত্রে
          (কিন্তু ভুল উত্তরের ঝুঁকি বাড়ে)
          <input
            type="number"
            name="confidenceThreshold"
            defaultValue={settings?.confidence_threshold ?? 0.5}
            min={0}
            max={1}
            step={0.05}
            style={{ width: 100 }}
          />
        </label>

        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          সেভ করুন
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Knowledge Base ডকুমেন্ট</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {documents.length === 0 && <p style={{ color: "#666" }}>এখনো কোনো ফাইল আপলোড হয়নি।</p>}
        {documents.map((d) => (
          <div key={d.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <strong>{d.file_name}</strong> <span style={{ color: "#666" }}>({d.file_type.toUpperCase()})</span>
                <div style={{ color: d.status === "failed" ? "#dc2626" : "#666", marginTop: 2 }}>
                  {statusLabel[d.status] ?? d.status}
                  {d.error_message && ` — ${d.error_message}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {d.status === "ready" && (
                  <button disabled={busy} onClick={() => toggleChunks(d.id)} style={{ width: "auto", flex: "0 0 auto" }}>
                    {expandedDocId === d.id ? "চাংক লুকান" : "চাংক দেখুন"}
                  </button>
                )}
                {d.status === "failed" && (
                  <button disabled={busy} onClick={() => handleReprocess(d.id)} style={{ width: "auto", flex: "0 0 auto" }}>
                    আবার চেষ্টা করুন
                  </button>
                )}
                <button disabled={busy} onClick={() => handleDelete(d.id)} style={{ width: "auto", flex: "0 0 auto", color: "#dc2626" }}>
                  মুছুন
                </button>
              </div>
            </div>
            {expandedDocId === d.id && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {!chunksByDoc[d.id] && <p style={{ fontSize: 12, color: "#666" }}>লোড হচ্ছে...</p>}
                {chunksByDoc[d.id]?.length === 0 && <p style={{ fontSize: 12, color: "#666" }}>কোনো chunk নেই।</p>}
                {chunksByDoc[d.id]?.map((c, i) => (
                  <div key={c.id} style={{ background: "#f9fafb", borderRadius: 6, padding: 8, fontSize: 12 }}>
                    <div style={{ color: "#999", marginBottom: 2 }}>chunk {i + 1}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form action={handleUpload} className="auth-card">
        <label>
          নতুন ফাইল আপলোড (PDF, XLSX, CSV, TXT — সর্বোচ্চ 10MB)
          <input type="file" name="file" accept=".pdf,.xlsx,.xls,.csv,.txt" required style={{ width: "100%" }} />
        </label>
        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>
          আপলোড করুন
        </button>
      </form>
    </div>
  );
}
