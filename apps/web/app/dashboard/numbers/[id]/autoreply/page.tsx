import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureChatbotConfig } from "./actions";
import AutoReplySettings from "./AutoReplySettings";

export default async function AutoReplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name")
    .eq("id", id)
    .maybeSingle();

  if (!number) notFound();

  const { configId, error } = await ensureChatbotConfig(id);
  if (error || !configId) {
    return <p style={{ color: "#dc2626" }}>{error ?? "সেটিংস লোড করা যায়নি"}</p>;
  }

  const { data: config } = await supabase
    .from("chatbot_configs")
    .select("id, is_active, welcome_message, fallback_message")
    .eq("id", configId)
    .single();

  const { data: rules } = await supabase
    .from("chatbot_rules")
    .select("id, keyword, match_type, reply_text, priority, is_active")
    .eq("chatbot_config_id", configId)
    .order("priority", { ascending: true });

  return <AutoReplySettings numberName={number.display_name} config={config!} rules={rules ?? []} />;
}
