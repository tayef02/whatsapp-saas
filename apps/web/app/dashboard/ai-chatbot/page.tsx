import { createClient } from "@/lib/supabase/server";
import AiChatbotSettings from "./AiChatbotSettings";
import { FULL_TEXT_MODE_MAX_WORDS } from "@whatsapp-saas/core/chatbot/constants";

export default async function AiChatbotPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("workspace_ai_settings")
    .select("llm_provider, system_prompt, support_phone, typical_delivery_time, api_key_secret_id")
    .maybeSingle();

  const { data: documents } = await supabase
    .from("knowledge_base_documents")
    .select("id, file_name, file_type, status, error_message, created_at, word_count")
    .order("created_at", { ascending: false });

  const totalReadyWords = (documents ?? [])
    .filter((d) => d.status === "ready")
    .reduce((sum, d) => sum + (d.word_count ?? 0), 0);

  return (
    <AiChatbotSettings
      settings={settings ?? null}
      documents={documents ?? []}
      totalReadyWords={totalReadyWords}
      fullTextModeMaxWords={FULL_TEXT_MODE_MAX_WORDS}
    />
  );
}
