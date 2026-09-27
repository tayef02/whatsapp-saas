"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addKeywordRule(groupId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, workspace_id").eq("id", groupId).maybeSingle();
  if (!group) return { error: "গ্রুপ পাওয়া যায়নি" };

  const keyword = String(formData.get("keyword") ?? "").trim();
  const replyText = String(formData.get("replyText") ?? "").trim();
  const cooldownMinutes = Number(formData.get("cooldownMinutes") ?? 5);

  if (!keyword) return { error: "কিওয়ার্ড দিন" };
  if (!replyText) return { error: "রিপ্লাই টেক্সট দিন" };
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0) return { error: "সঠিক cooldown সময় দিন" };

  const { error } = await supabase.from("group_keyword_replies").insert({
    group_id: groupId,
    workspace_id: group.workspace_id,
    keyword,
    reply_text: replyText,
    cooldown_seconds: Math.round(cooldownMinutes * 60),
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/groups/${groupId}/keywords`);
  return { error: null };
}

export async function toggleKeywordRule(ruleId: string, groupId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("group_keyword_replies").update({ is_active: isActive }).eq("id", ruleId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/groups/${groupId}/keywords`);
  return { error: null };
}

export async function deleteKeywordRule(ruleId: string, groupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("group_keyword_replies").delete().eq("id", ruleId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/groups/${groupId}/keywords`);
  return { error: null };
}
