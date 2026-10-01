import { getSupabase } from "../lib/supabase";
import { extractText } from "../lib/extract-text";
import { chunkText } from "@whatsapp-saas/core/chatbot/chunk";
import { generateEmbedding, type LlmProvider } from "@whatsapp-saas/core/chatbot/llm";
import { KNOWLEDGE_BASE_BUCKET } from "@whatsapp-saas/core/chatbot/constants";

// WhatsApp এর process-knowledge-base.ts এর হুবহু একই প্যাটার্ন — শুধু
// messenger_knowledge_base_documents/messenger_knowledge_base_chunks/get_messenger_ai_api_key/
// search_messenger_knowledge_base টার্গেট করে। bucket একই (knowledge-base-docs) reuse হয়,
// Messenger এর ফাইলের path "{workspace_id}/messenger/..." (workspace_id প্রথম ফোল্ডারে, যদিও
// বাস্তবে সব অ্যাক্সেস service_role দিয়ে হয় বলে storage RLS কার্যত প্রযোজ্য না)।
export type MessengerKnowledgeBaseJobData = { documentId: string };

export async function processMessengerKnowledgeBaseDocument(data: MessengerKnowledgeBaseJobData) {
  const supabase = getSupabase();

  const { data: doc } = await supabase
    .from("messenger_knowledge_base_documents")
    .select("id, workspace_id, file_path, file_type, file_name")
    .eq("id", data.documentId)
    .maybeSingle();

  if (!doc) {
    console.error(`[messenger-knowledge-base] document ${data.documentId} পাওয়া যায়নি`);
    return;
  }

  console.log(`[messenger-knowledge-base] প্রসেসিং শুরু: ${doc.file_name} (${doc.id})`);
  await supabase.from("messenger_knowledge_base_documents").update({ status: "processing" }).eq("id", doc.id);

  try {
    const { data: settings } = await supabase
      .from("messenger_ai_settings")
      .select("llm_provider")
      .eq("workspace_id", doc.workspace_id)
      .maybeSingle();

    if (!settings?.llm_provider) {
      throw new Error("workspace এ Messenger এর জন্য কোনো LLM provider সেট করা নেই — Messenger AI Chatbot সেটিংসে আগে provider+API key দিন");
    }

    const { data: apiKey } = await supabase.rpc("get_messenger_ai_api_key", { p_workspace_id: doc.workspace_id });
    if (!apiKey) {
      throw new Error("workspace এ Messenger এর জন্য কোনো API key সেট করা নেই");
    }

    const provider = settings.llm_provider as LlmProvider;

    const { data: fileBlob, error: downloadError } = await supabase.storage.from(KNOWLEDGE_BASE_BUCKET).download(doc.file_path);
    if (downloadError || !fileBlob) throw new Error(`ফাইল ডাউনলোড ব্যর্থ: ${downloadError?.message}`);

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const text = await extractText(doc.file_type as "pdf" | "xlsx" | "csv" | "txt", buffer);

    if (!text.trim()) throw new Error("ফাইল থেকে কোনো টেক্সট পাওয়া যায়নি");

    console.log(`[messenger-knowledge-base] ${doc.file_name}: extract হওয়া টেক্সট (প্রথম ৫০০ অক্ষর):\n${text.slice(0, 500)}`);

    const chunks = chunkText(text);
    console.log(`[messenger-knowledge-base] ${doc.file_name}: ${chunks.length}টা chunk, প্রথমটা: "${chunks[0]?.slice(0, 150)}"`);

    // আগের chunk (re-process এর ক্ষেত্রে) মুছে নতুন করে বসানো হচ্ছে
    await supabase.from("messenger_knowledge_base_chunks").delete().eq("document_id", doc.id);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(provider, apiKey, chunk);
      const row: Record<string, unknown> = {
        workspace_id: doc.workspace_id,
        document_id: doc.id,
        content: chunk,
      };
      row[provider === "openai" ? "embedding_openai" : "embedding_gemini"] = JSON.stringify(embedding);
      const { error: insertError } = await supabase.from("messenger_knowledge_base_chunks").insert(row);
      if (insertError) throw new Error(`chunk সেভ করা যায়নি: ${insertError.message}`);
    }

    const wordCount = text.trim().split(/\s+/).length;
    await supabase
      .from("messenger_knowledge_base_documents")
      .update({ status: "ready", error_message: null, full_text: text, word_count: wordCount })
      .eq("id", doc.id);
    console.log(`[messenger-knowledge-base] ${doc.file_name} প্রসেসিং সম্পন্ন, word_count=${wordCount}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "অজানা এরর";
    console.error(`[messenger-knowledge-base] ${doc.file_name} ব্যর্থ: ${message}`);
    await supabase.from("messenger_knowledge_base_documents").update({ status: "failed", error_message: message }).eq("id", doc.id);
  }
}
