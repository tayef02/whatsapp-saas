import { getSupabase } from "../lib/supabase";
import { extractText } from "../lib/extract-text";
import { chunkText } from "@whatsapp-saas/core/chatbot/chunk";
import { generateEmbedding, type LlmProvider } from "@whatsapp-saas/core/chatbot/llm";
import { KNOWLEDGE_BASE_BUCKET } from "@whatsapp-saas/core/chatbot/constants";

export type KnowledgeBaseJobData = { documentId: string };

// আপলোড করা ফাইল ডাউনলোড → টেক্সট বের করা → ছোট অংশে ভাঙা → প্রতিটার embedding বানিয়ে
// সেভ করা। workspace এ কোনো LLM provider/key সেট না থাকলে ব্যর্থ (status='failed')
export async function processKnowledgeBaseDocument(data: KnowledgeBaseJobData) {
  const supabase = getSupabase();

  const { data: doc } = await supabase
    .from("knowledge_base_documents")
    .select("id, workspace_id, file_path, file_type, file_name")
    .eq("id", data.documentId)
    .maybeSingle();

  if (!doc) {
    console.error(`[knowledge-base] document ${data.documentId} পাওয়া যায়নি`);
    return;
  }

  console.log(`[knowledge-base] প্রসেসিং শুরু: ${doc.file_name} (${doc.id})`);
  await supabase.from("knowledge_base_documents").update({ status: "processing" }).eq("id", doc.id);

  try {
    const { data: settings } = await supabase
      .from("workspace_ai_settings")
      .select("llm_provider")
      .eq("workspace_id", doc.workspace_id)
      .maybeSingle();

    if (!settings?.llm_provider) {
      throw new Error("workspace এ কোনো LLM provider সেট করা নেই — Settings এ গিয়ে আগে provider+API key দিন");
    }

    const { data: apiKey } = await supabase.rpc("get_workspace_api_key", { p_workspace_id: doc.workspace_id });
    if (!apiKey) {
      throw new Error("workspace এ কোনো API key সেট করা নেই");
    }

    const provider = settings.llm_provider as LlmProvider;

    const { data: fileBlob, error: downloadError } = await supabase.storage.from(KNOWLEDGE_BASE_BUCKET).download(doc.file_path);
    if (downloadError || !fileBlob) throw new Error(`ফাইল ডাউনলোড ব্যর্থ: ${downloadError?.message}`);

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const text = await extractText(doc.file_type as "pdf" | "xlsx" | "csv" | "txt", buffer);

    if (!text.trim()) throw new Error("ফাইল থেকে কোনো টেক্সট পাওয়া যায়নি");

    console.log(`[knowledge-base] ${doc.file_name}: extract হওয়া টেক্সট (প্রথম ৫০০ অক্ষর):\n${text.slice(0, 500)}`);

    const chunks = chunkText(text);
    console.log(`[knowledge-base] ${doc.file_name}: ${chunks.length}টা chunk, প্রথমটা: "${chunks[0]?.slice(0, 150)}"`);

    // আগের chunk (re-process এর ক্ষেত্রে) মুছে নতুন করে বসানো হচ্ছে
    await supabase.from("knowledge_base_chunks").delete().eq("document_id", doc.id);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(provider, apiKey, chunk);
      const row: Record<string, unknown> = {
        workspace_id: doc.workspace_id,
        document_id: doc.id,
        content: chunk,
      };
      row[provider === "openai" ? "embedding_openai" : "embedding_gemini"] = JSON.stringify(embedding);
      const { error: insertError } = await supabase.from("knowledge_base_chunks").insert(row);
      if (insertError) throw new Error(`chunk সেভ করা যায়নি: ${insertError.message}`);
    }

    const wordCount = text.trim().split(/\s+/).length;
    await supabase
      .from("knowledge_base_documents")
      .update({ status: "ready", error_message: null, full_text: text, word_count: wordCount })
      .eq("id", doc.id);
    console.log(`[knowledge-base] ${doc.file_name} প্রসেসিং সম্পন্ন, word_count=${wordCount}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "অজানা এরর";
    console.error(`[knowledge-base] ${doc.file_name} ব্যর্থ: ${message}`);
    await supabase.from("knowledge_base_documents").update({ status: "failed", error_message: message }).eq("id", doc.id);
  }
}
