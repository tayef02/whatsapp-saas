"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailMemberContext } from "@/lib/email/member-context";
import { normalizeEmail } from "@whatsapp-saas/core/email/address";
import { EMAIL_TAG_MAX_LENGTH } from "@whatsapp-saas/core/email/constants";
import { emailSkipReasonLabel } from "@whatsapp-saas/core/email/skip-reasons";

// লেখা service_role দিয়ে (টেবিলে ব্রাউজারের শুধু SELECT) — workspace_id সবসময় সেশন থেকে, ফর্ম থেকে না।

function parseTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((t) => t.trim().slice(0, EMAIL_TAG_MAX_LENGTH))
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 20);
}

export async function createEmailContact(formData: FormData) {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };

  // সম্মতি-নিশ্চিতকরণ বাধ্যতামূলক — টিক ছাড়া কন্টাক্ট বসে না
  if (formData.get("consent") !== "on") return { error: "সম্মতি নিশ্চিত করে টিক দিন — এটা ছাড়া কন্টাক্ট যোগ করা যাবে না" };

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "ইমেইল ঠিকানাটা সঠিক না (যেমন: name@example.com)" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 200) || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));

  const admin = createAdminClient();

  // ব্লক-তালিকায় (আনসাবস্ক্রাইব/বাউন্স/স্প্যাম) থাকলে যোগ করা হয় না, কারণ জানানো হয়
  const { data: suppressed, error: suppressedError } = await admin
    .from("email_suppressions")
    .select("reason")
    .eq("workspace_id", ctx.workspaceId)
    .eq("email_lower", email)
    .maybeSingle();
  if (suppressedError) return { error: suppressedError.message };
  if (suppressed) {
    return { error: `এই ঠিকানায় আর ইমেইল পাঠানো যাবে না — ${emailSkipReasonLabel(`suppressed_${suppressed.reason}`)}` };
  }

  const { error } = await admin.from("email_contacts").insert({
    workspace_id: ctx.workspaceId,
    email,
    name,
    tags,
    source: "manual",
    consent_source: "manual_attested",
    consented_by: ctx.userId,
    consented_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { error: "এই ইমেইল আগে থেকেই আছে" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/email/contacts");
  return { error: null };
}

export async function updateEmailContact(id: string, formData: FormData) {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };

  const name = String(formData.get("name") ?? "").trim().slice(0, 200) || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));

  const { data, error } = await createAdminClient()
    .from("email_contacts")
    .update({ name, tags, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "কন্টাক্ট পাওয়া যায়নি" };

  revalidatePath("/dashboard/email/contacts");
  return { error: null };
}

export async function deleteEmailContact(id: string) {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await createAdminClient().from("email_contacts").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/email/contacts");
  return { error: null };
}
