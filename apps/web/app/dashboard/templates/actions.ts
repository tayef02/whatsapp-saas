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

// path এ extension রাখা হয়নি (upsert দিয়ে একই path রিইউজ হয়, তাই টাইপ বদলালেও পুরনো
// ফাইল এতিম হয়ে থাকে না)
async function uploadMediaIfProvided(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  templateId: string,
  file: File | null
): Promise<{ mediaUrl: string | null; mediaType: "image" | "document" | null; error: string | null }> {
  if (!file || file.size === 0) {
    return { mediaUrl: null, mediaType: null, error: null };
  }

  if (file.size > MAX_TEMPLATE_MEDIA_BYTES) {
    return {
      mediaUrl: null,
      mediaType: null,
      error: `ফাইল সাইজ সর্বোচ্চ ${MAX_TEMPLATE_MEDIA_BYTES / (1024 * 1024)}MB হতে পারবে`,
    };
  }

  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    return { mediaUrl: null, mediaType: null, error: "শুধু ছবি বা PDF আপলোড করা যাবে" };
  }

  const path = `${workspaceId}/${templateId}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(TEMPLATE_MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { mediaUrl: null, mediaType: null, error: uploadError.message };
  }

  const { data: pub } = admin.storage.from(TEMPLATE_MEDIA_BUCKET).getPublicUrl(path);

  return { mediaUrl: pub.publicUrl, mediaType: isImage ? "image" : "document", error: null };
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
  const id = randomUUID();

  const media = await uploadMediaIfProvided(admin, workspaceId, id, file);
  if (media.error) return { error: media.error };

  const { error } = await admin.from("templates").insert({
    id,
    workspace_id: workspaceId,
    name,
    content,
    category,
    media_url: media.mediaUrl,
    media_type: media.mediaType,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { error: null, id };
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
  const media = await uploadMediaIfProvided(admin, workspaceId, id, file);
  if (media.error) return { error: media.error };

  const update: Record<string, unknown> = { name, content, category };
  if (media.mediaUrl) {
    update.media_url = media.mediaUrl;
    update.media_type = media.mediaType;
  }

  const { error } = await supabase.from("templates").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { error: null };
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) return { error: error.message };

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
