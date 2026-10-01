import { createClient } from "@/lib/supabase/server";
import MessengerAiChatbotSettings from "./MessengerAiChatbotSettings";
import { FULL_TEXT_MODE_MAX_WORDS } from "@whatsapp-saas/core/chatbot/constants";

// Phase ১ (চ্যানেল বিচ্ছিন্নতা): আগে এখানে একটা "শেয়ার্ড সেটিংস" তথ্য-কার্ড ছিল যা WhatsApp
// এর পেজে রিডাইরেক্ট করত — এখন এটা সম্পূর্ণ আসল সেটিংস পেজ, নিজস্ব messenger_ai_settings/
// messenger_knowledge_base_documents টেবিল পড়ে (WhatsApp এর AI ডেটা এখানে ছোঁয়া হয় না)
export default async function MessengerAiChatbotPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("messenger_ai_settings")
    .select("llm_provider, system_prompt, support_phone, typical_delivery_time, api_key_secret_id")
    .maybeSingle();

  const { data: documents } = await supabase
    .from("messenger_knowledge_base_documents")
    .select("id, file_name, file_type, status, error_message, created_at, word_count")
    .order("created_at", { ascending: false });

  const totalReadyWords = (documents ?? []).filter((d) => d.status === "ready").reduce((sum, d) => sum + (d.word_count ?? 0), 0);

  return (
    <MessengerAiChatbotSettings
      settings={settings ?? null}
      documents={documents ?? []}
      totalReadyWords={totalReadyWords}
      fullTextModeMaxWords={FULL_TEXT_MODE_MAX_WORDS}
    />
  );
}
