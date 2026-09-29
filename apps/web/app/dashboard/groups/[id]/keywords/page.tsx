import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KeywordRulesList from "./KeywordRulesList";

export default async function GroupKeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id").eq("id", id).maybeSingle();
  if (!group) notFound();

  const { data: rules } = await supabase
    .from("group_keyword_replies")
    .select("id, trigger_type, reply_mode, keyword, reply_text, cooldown_seconds, is_active, last_triggered_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false });

  return <KeywordRulesList groupId={id} rules={rules ?? []} />;
}
