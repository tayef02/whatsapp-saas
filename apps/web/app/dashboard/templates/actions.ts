"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTemplateBraces } from "@whatsapp-saas/core/templates/validate";
import { extractVariableKeys } from "@whatsapp-saas/core/templates/variables";
import { TEMPLATE_MEDIA_BUCKET, MAX_TEMPLATE_MEDIA_BYTES } from "@whatsapp-saas/core/templates/constants";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

// bucket private, তাই এখানে কোনো URL রিটার্ন হয় না — শুধু storage path।
// মেসেজ পাঠানোর সময় (মডিউল ৫) worker getSignedTemplateMediaUrl() দিয়ে অল্প সময়ের
// URL বানিয়ে নেবে। ফাইলের নাম random (templateId না) — path অনুমান করা কঠিন করার জন্য।
async function uploadMediaIfProvided(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  file: File | null
): Promise<{ mediaPath: string | null; mediaType: "image" | "document" | null; error: string | null }> {
  if (!file || file.size === 0) {
    return { mediaPath: null, mediaType: null, error: null };
  }

  if (file.size > MAX_TEMPLATE_MEDIA_BYTES) {
    return {
      mediaPath: null,
      mediaType: null,
      error: `ফাইল সাইজ সর্বোচ্চ ${MAX_TEMPLATE_MEDIA_BYTES / (1024 * 1024)}MB হতে পারবে`,
    };
  }

  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    return { mediaPath: null, mediaType: null, error: "শুধু ছবি বা PDF আপলোড করা যাবে" };
  }

  const path = `${workspaceId}/${randomUUID()}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(TEMPLATE_MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    return { mediaPath: null, mediaType: null, error: uploadError.message };
  }

  return { mediaPath: path, mediaType: isImage ? "image" : "document", error: null };
}

async function deleteMediaIfExists(admin: ReturnType<typeof createAdminClient>, path: string | null) {
  if (!path) return;
  await admin.storage.from(TEMPLATE_MEDIA_BUCKET).remove([path]);
}

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const name = String(formData.get("name") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const category = String(formData.get("category") ?? "").trim() || null;
  const file = formData.get("media") as File | null;

  if (!name) return { error: "টেমপ্লেটের নাম দিন" };

  const braceError = validateTemplateBraces(content);
  if (braceError) return { error: braceError };

  const admin = createAdminClient();

  const media = await uploadMediaIfProvided(admin, workspaceId, file);
  if (media.error) return { error: media.error };

  const { data: inserted, error } = await admin
    .from("templates")
    .insert({
      workspace_id: workspaceId,
      name,
      content,
      category,
      media_url: media.mediaPath,
      media_type: media.mediaType,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { error: null, id: inserted.id as string };
}

export async function updateTemplate(id: string, formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const name = String(formData.get("name") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const category = String(formData.get("category") ?? "").trim() || null;
  const file = formData.get("media") as File | null;

  if (!name) return { error: "টেমপ্লেটের নাম দিন" };

  const braceError = validateTemplateBraces(content);
  if (braceError) return { error: braceError };

  const admin = createAdminClient();

  const media = await uploadMediaIfProvided(admin, workspaceId, file);
  if (media.error) return { error: media.error };

  const update: Record<string, unknown> = { name, content, category };

  if (media.mediaPath) {
    // নতুন ফাইল এসেছে — পুরনোটা মুছে ফেলা হবে যাতে storage তে এতিম ফাইল জমে না থাকে
    const { data: existing } = await supabase.from("templates").select("media_url").eq("id", id).maybeSingle();
    await deleteMediaIfExists(admin, existing?.media_url ?? null);

    update.media_url = media.mediaPath;
    update.media_type = media.mediaType;
  }

  const { error } = await supabase.from("templates").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { error: null };
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("templates").select("media_url").eq("id", id).maybeSingle();

  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) return { error: error.message };

  if (existing?.media_url) {
    await deleteMediaIfExists(createAdminClient(), existing.media_url);
  }

  revalidatePath("/dashboard/templates");
  return { error: null };
}

export interface VariableCoverage {
  key: string;
  missingCount: number;
  totalContacts: number;
}

// টেমপ্লেটে ব্যবহৃত প্রতিটা {{key}} এর জন্য, workspace এর কতজন কন্টাক্টে ওই ফিল্ড নেই তা গোনে
export async function checkVariableCoverage(content: string): Promise<{ error: string | null; coverage: VariableCoverage[] }> {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি", coverage: [] };

  const keys = extractVariableKeys(content);
  if (keys.length === 0) return { error: null, coverage: [] };

  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  const coverage: VariableCoverage[] = [];

  for (const key of keys) {
    let query = supabase.from("contacts").select("id", { count: "exact", head: true });

    if (key === "name") {
      query = query.is("name", null);
    } else if (key === "phone") {
      // phone সবসময় থাকে (not null কলাম), তাই এটার জন্য চেক করার দরকার নেই
      continue;
    } else {
      query = query.filter(`custom_fields->>${key}`, "is", null);
    }

    const { count } = await query;
    coverage.push({ key, missingCount: count ?? 0, totalContacts: totalContacts ?? 0 });
  }

  return { error: null, coverage };
}

// কনটেন্ট textarea এ বসানোর জন্য ভেরিয়েবল সাজেশন — workspace এর কন্টাক্টে যেসব
// custom_fields key পাওয়া গেছে (সবগুলো না দেখিয়ে একটা sample থেকে)
export async function getVariableSuggestions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("custom_fields").limit(50);

  const keys = new Set<string>(["name", "phone"]);
  for (const row of data ?? []) {
    for (const key of Object.keys((row.custom_fields as Record<string, string>) ?? {})) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}
