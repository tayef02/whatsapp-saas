"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addKeywordRule(groupId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, workspace_id").eq("id", groupId).maybeSingle();
  if (!group) return { error: "গ্রুপ পাওয়া যায়নি" };

  const triggerType = String(formData.get("triggerType") ?? "keyword");
  const replyMode = String(formData.get("replyMode") ?? "fixed");
  const keyword = String(formData.get("keyword") ?? "").trim();
  const replyText = String(formData.get("replyText") ?? "").trim();
  const cooldownMinutes = Number(formData.get("cooldownMinutes") ?? 5);

  if (triggerType !== "keyword" && triggerType !== "mention") return { error: "সঠিক ট্রিগার বাছাই করুন" };
  if (replyMode !== "fixed" && replyMode !== "ai") return { error: "সঠিক রিপ্লাই মোড বাছাই করুন" };
  if (triggerType === "keyword" && !keyword) return { error: "কিওয়ার্ড দিন" };
  if (replyMode === "fixed" && !replyText) return { error: "ফিক্সড মোডে রিপ্লাই টেক্সট দিতে হবে" };
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0) return { error: "সঠিক cooldown সময় দিন" };

  const { error } = await supabase.from("group_keyword_replies").insert({
    group_id: groupId,
    workspace_id: group.workspace_id,
    trigger_type: triggerType,
    reply_mode: replyMode,
    keyword: triggerType === "keyword" ? keyword : null,
    reply_text: replyMode === "fixed" ? replyText : null,
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
