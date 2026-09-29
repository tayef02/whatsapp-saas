"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeBangladeshiPhone } from "@whatsapp-saas/core/utils/phone";
import { getWorkspacePlanInfo, getContactCount } from "@/lib/subscriptions/limits";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return membership?.workspace_id as string | undefined;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseCustomFields(input: string): Record<string, string> {
  try {
    const parsed = JSON.parse(input || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ফাঁকা/ভুল হলে খালি অবজেক্ট
  }
  return {};
}

export async function createContact(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const phone = normalizeBangladeshiPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "নাম্বারটা সঠিক না (যেমন: 01712345678)" };

  const { plan } = await getWorkspacePlanInfo(supabase, workspaceId);
  if (plan) {
    const current = await getContactCount(supabase, workspaceId);
    if (current >= plan.contact_limit) {
      return { error: `আপনার প্ল্যানে সর্বোচ্চ ${plan.contact_limit} জন কন্টাক্ট রাখা যায় — প্ল্যান আপগ্রেড করুন` };
    }
  }

  const name = String(formData.get("name") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const customFields = parseCustomFields(String(formData.get("customFields") ?? ""));

  const { error } = await supabase.from("contacts").insert({
    workspace_id: workspaceId,
    phone,
    name,
    tags,
    custom_fields: customFields,
    source: "manual",
  });

  if (error) {
    if (error.code === "23505") return { error: "এই নাম্বার আগে থেকেই আছে" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/contacts");
  return { error: null };
}

export async function updateContact(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const customFields = parseCustomFields(String(formData.get("customFields") ?? ""));

  const { error } = await supabase.from("contacts").update({ name, tags, custom_fields: customFields }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { error: null };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { error: null };
}

// opt-out করা কন্টাক্টকে ইউজার হাতে আবার চালু করতে পারবে
export async function reactivateContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ opted_out: false }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { error: null };
}

// টেবিলে একাধিক কন্টাক্ট সিলেক্ট করে বাল্ক ট্যাগ যোগ/মুছা — tags কলাম text[] বলে প্রতিটা রো এর
// বর্তমান tags এনে JS তে merge/remove করে আলাদাভাবে আপডেট করা হচ্ছে (নতুন কোনো SQL ফাংশন লাগেনি)
export async function bulkAddTag(contactIds: string[], tag: string) {
  const cleanTag = tag.trim();
  if (!cleanTag) return { error: "ট্যাগ লিখুন" };
  if (contactIds.length === 0) return { error: "কোনো কন্টাক্ট বাছাই করা হয়নি" };

  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase.from("contacts").select("id, tags").in("id", contactIds);
  if (fetchError) return { error: fetchError.message };

  const results = await Promise.all(
    (rows ?? []).map((r) => {
      if (r.tags.includes(cleanTag)) return Promise.resolve({ error: null });
      return supabase
        .from("contacts")
        .update({ tags: [...r.tags, cleanTag] })
        .eq("id", r.id);
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: (failed.error as { message: string }).message };

  revalidatePath("/dashboard/contacts");
  return { error: null };
}

export async function bulkRemoveTag(contactIds: string[], tag: string) {
  const cleanTag = tag.trim();
  if (!cleanTag) return { error: "ট্যাগ লিখুন" };
  if (contactIds.length === 0) return { error: "কোনো কন্টাক্ট বাছাই করা হয়নি" };

  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase.from("contacts").select("id, tags").in("id", contactIds);
  if (fetchError) return { error: fetchError.message };

  const results = await Promise.all(
    (rows ?? []).map((r) =>
      supabase
        .from("contacts")
        .update({ tags: r.tags.filter((t: string) => t !== cleanTag) })
        .eq("id", r.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: (failed.error as { message: string }).message };

  revalidatePath("/dashboard/contacts");
  return { error: null };
}
