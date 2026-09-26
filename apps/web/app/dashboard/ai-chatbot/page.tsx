import { createClient } from "@/lib/supabase/server";
import AiChatbotSettings from "./AiChatbotSettings";

export default async function AiChatbotPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("workspace_ai_settings")
    .select("llm_provider, system_prompt, confidence_threshold, api_key_secret_id")
    .maybeSingle();

  const { data: documents } = await supabase
    .from("knowledge_base_documents")
    .select("id, file_name, file_type, status, error_message, created_at")
    .order("created_at", { ascending: false });

  return <AiChatbotSettings settings={settings ?? null} documents={documents ?? []} />;
}
