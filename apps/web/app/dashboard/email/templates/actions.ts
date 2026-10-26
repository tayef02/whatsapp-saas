"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailMemberContext } from "@/lib/email/member-context";
import { stripDangerousHtml } from "@whatsapp-saas/core/email/html";
import { validateEmailTemplate } from "@whatsapp-saas/core/email/validate-template";

type SaveResult = { error: string | null; id?: string };

// লেখা service_role দিয়ে (টেবিলে ব্রাউজারের শুধু SELECT) — workspace_id সেশন থেকে।
// ফুটার/আনসাবস্ক্রাইব এখানে টেমপ্লেটে ঢোকানো হয় না, বাদও দেওয়া যায় না: পাঠানোর ধাপে (ফেজ ৩)
// appendEmailFooter() প্রতিটা ইমেইলে নিজে যোগ করে — টেমপ্লেটের ভেতরের কিছুর উপর নির্ভর করে না।
export async function saveEmailTemplate(id: string | null, formData: FormData): Promise<SaveResult> {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };

  const input = {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim().slice(0, 60) || null,
    subject: String(formData.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim(),
    preheader: String(formData.get("preheader") ?? "").trim() || null,
    body_html: stripDangerousHtml(String(formData.get("bodyHtml") ?? "")),
    body_text: String(formData.get("bodyText") ?? ""),
  };

  const validationError = validateEmailTemplate(input);
  if (validationError) return { error: validationError };

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (id) {
    const { data, error } = await admin
      .from("email_templates")
      .update({ ...input, updated_at: nowIso })
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "টেমপ্লেট পাওয়া যায়নি" };

    revalidatePath("/dashboard/email/templates");
    return { error: null, id };
  }

  const { data, error } = await admin
    .from("email_templates")
    .insert({ workspace_id: ctx.workspaceId, ...input })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "সেভ করা যায়নি" };

  revalidatePath("/dashboard/email/templates");
  return { error: null, id: data.id as string };
}

export async function deleteEmailTemplate(id: string) {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await createAdminClient().from("email_templates").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/email/templates");
  return { error: null };
}
