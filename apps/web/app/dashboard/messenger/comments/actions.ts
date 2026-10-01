"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// WhatsApp গ্রুপের addKeywordRule/toggleKeywordRule/deleteKeywordRule (groups/[id]/keywords/
// actions.ts) এর ঠিক একই প্যাটার্ন — শুধু trigger_type এ "mention" এর বদলে "all" (কমেন্টে
// @mention কনসেপ্ট নেই), আর নতুন action ফিল্ড (public_reply | private_reply)
export async function addCommentRule(pageId: string, formData: FormData) {
  const supabase = await createClient();

  // RLS-স্কোপড সিলেক্ট — পেজটা এই ইউজারের workspace এর না হলে এখানেই থেমে যাবে
  const { data: page } = await supabase.from("messenger_pages").select("id, workspace_id").eq("id", pageId).maybeSingle();
  if (!page) return { error: "পেজ পাওয়া যায়নি" };

  const triggerType = String(formData.get("triggerType") ?? "keyword");
  const action = String(formData.get("action") ?? "public_reply");
  const replyMode = String(formData.get("replyMode") ?? "fixed");
  const keyword = String(formData.get("keyword") ?? "").trim();
  const replyText = String(formData.get("replyText") ?? "").trim();
  const cooldownMinutes = Number(formData.get("cooldownMinutes") ?? 5);

  if (triggerType !== "keyword" && triggerType !== "all") return { error: "সঠিক ট্রিগার বাছাই করুন" };
  if (action !== "public_reply" && action !== "private_reply") return { error: "সঠিক অ্যাকশন বাছাই করুন" };
  if (replyMode !== "fixed" && replyMode !== "ai") return { error: "সঠিক রিপ্লাই মোড বাছাই করুন" };
  if (triggerType === "keyword" && !keyword) return { error: "কিওয়ার্ড দিন" };
  if (replyMode === "fixed" && !replyText) return { error: "ফিক্সড মোডে রিপ্লাই টেক্সট দিতে হবে" };
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0) return { error: "সঠিক cooldown সময় দিন" };

  const { error } = await supabase.from("messenger_comment_rules").insert({
    messenger_page_id: pageId,
    workspace_id: page.workspace_id,
    trigger_type: triggerType,
    action,
    reply_mode: replyMode,
    keyword: triggerType === "keyword" ? keyword : null,
    reply_text: replyMode === "fixed" ? replyText : null,
    cooldown_seconds: Math.round(cooldownMinutes * 60),
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/comments");
  return { error: null };
}

export async function toggleCommentRule(ruleId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("messenger_comment_rules").update({ is_active: isActive }).eq("id", ruleId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/comments");
  return { error: null };
}

export async function deleteCommentRule(ruleId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("messenger_comment_rules").delete().eq("id", ruleId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/comments");
  return { error: null };
}
