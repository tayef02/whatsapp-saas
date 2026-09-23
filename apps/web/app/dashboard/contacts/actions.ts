"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeBangladeshiPhone } from "@whatsapp-saas/core/utils/phone";

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

export async function createContact(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const phone = normalizeBangladeshiPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "নাম্বারটা সঠিক না (যেমন: 01712345678)" };

  const name = String(formData.get("name") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));

  const { error } = await supabase.from("contacts").insert({
    workspace_id: workspaceId,
    phone,
    name,
    tags,
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

  const { error } = await supabase.from("contacts").update({ name, tags }).eq("id", id);

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
