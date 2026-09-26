export type LlmProvider = "openai" | "gemini";

const REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const cause = err instanceof Error ? (err.cause as { code?: string; message?: string } | undefined) : undefined;
    const causeInfo = cause ? ` — cause: ${cause.code ?? ""} ${cause.message ?? ""}`.trim() : "";
    throw new Error(`LLM API রিকোয়েস্ট ব্যর্থ (${url}): ${err instanceof Error ? err.message : String(err)}${causeInfo}`);
  }
}

// OpenAI text-embedding-3-small (1536 dim) বা Gemini text-embedding-004 (768 dim) —
// প্রশ্ন/ডকুমেন্ট চাংক দুটোই একই ফাংশন দিয়ে embed হয় (একই মডেল দিয়ে না করলে তুলনা অর্থহীন হয়ে যায়)
export async function generateEmbedding(provider: LlmProvider, apiKey: string, text: string): Promise<number[]> {
  if (provider === "openai") {
    const res = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding ব্যর্থ (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as any;
    return data.data[0].embedding as number[];
  }

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text }] } }),
    }
  );
  if (!res.ok) throw new Error(`Gemini embedding ব্যর্থ (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.embedding.values as number[];
}

// knowledge base থেকে পাওয়া প্রাসঙ্গিক অংশ + system prompt দিয়ে স্বাভাবিক ভাষায় উত্তর জেনারেট করে
export async function generateChatReply(
  provider: LlmProvider,
  apiKey: string,
  systemPrompt: string,
  context: string,
  question: string
): Promise<string> {
  const fullSystemPrompt = `${systemPrompt}\n\nনিচের তথ্যের ভিত্তিতে কাস্টমারের প্রশ্নের উত্তর দাও। তথ্যে না থাকলে অনুমান করে উত্তর দিও না।\n\n${context}`;

  if (provider === "openai") {
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI chat ব্যর্থ (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as any;
    return data.choices[0].message.content as string;
  }

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini chat ব্যর্থ (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.candidates[0].content.parts[0].text as string;
}
