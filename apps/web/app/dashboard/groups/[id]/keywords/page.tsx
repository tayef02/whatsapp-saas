import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KeywordRulesList from "./KeywordRulesList";

export default async function GroupKeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", id).maybeSingle();
  if (!group) notFound();

  const { data: rules } = await supabase
    .from("group_keyword_replies")
    .select("id, trigger_type, reply_mode, keyword, reply_text, cooldown_seconds, is_active, last_triggered_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard/groups">← গ্রুপ লিস্টে ফিরুন</Link>
      </p>
      <h1>ট্রিগার রিপ্লাই — {group.name || "(নাম নেই)"}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        গ্রুপে কেউ কিওয়ার্ড লিখলে (মেসেজের যেকোনো জায়গায়, ছোট/বড় হাতের অক্ষর ধরা হয় না) বা bot-কে @mention করলে
        রিপ্লাই যাবে। রিপ্লাই দুই ধরনের হতে পারে — নির্দিষ্ট ফিক্সড টেক্সট, অথবা AI (workspace-এর সেই একই AI
        Chatbot — system prompt, knowledge base, কথোপকথনের ইতিহাস দেখে স্বাভাবিক ভাষায় উত্তর দেবে)। Cooldown —
        fixed মোডে মানে একই রিপ্লাই বারবার আটকানো, AI মোডে মানে কত ঘন ঘন AI call হতে পারবে (খরচ/স্প্যাম নিয়ন্ত্রণে)।
      </p>
      <KeywordRulesList groupId={id} rules={rules ?? []} />
    </div>
  );
}
