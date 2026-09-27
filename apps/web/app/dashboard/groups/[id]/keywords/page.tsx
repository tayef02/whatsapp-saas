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
    .select("id, keyword, reply_text, cooldown_seconds, is_active, last_triggered_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard/groups">← গ্রুপ লিস্টে ফিরুন</Link>
      </p>
      <h1>কিওয়ার্ড রিপ্লাই — {group.name || "(নাম নেই)"}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        গ্রুপে কেউ কিওয়ার্ড লিখলে (মেসেজের যেকোনো জায়গায়, ছোট/বড় হাতের অক্ষর ধরা হয় না) অটোমেটিক রিপ্লাই যাবে। একই
        কিওয়ার্ডে বারবার রিপ্লাই এড়াতে cooldown সময় সেট করুন।
      </p>
      <KeywordRulesList groupId={id} rules={rules ?? []} />
    </div>
  );
}
