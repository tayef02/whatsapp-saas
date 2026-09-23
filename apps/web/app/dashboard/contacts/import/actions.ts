"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContactImportQueue } from "@/lib/queue/contact-import-queue";
import { parseContactFile } from "@whatsapp-saas/core/contacts/parse";
import { normalizeContactRows } from "@whatsapp-saas/core/contacts/normalize-batch";
import { upsertContactsBatched } from "@whatsapp-saas/core/contacts/upsert";
import {
  SYNC_IMPORT_ROW_THRESHOLD,
  MAX_IMPORT_FILE_SIZE_BYTES,
  CONTACT_IMPORTS_BUCKET,
} from "@whatsapp-saas/core/contacts/constants";

type StartImportResult =
  | { error: string; done?: undefined; importJobId?: undefined }
  | { error: null; done: true; added: number; duplicate: number; invalid: number }
  | { error: null; done: false; importJobId: string };

// ছোট ফাইল সাথে সাথে প্রসেস করে ফলাফল ফেরত দেয়। বড় ফাইল (SYNC_IMPORT_ROW_THRESHOLD এর বেশি রো)
// storage এ আপলোড করে queue তে job বসিয়ে দেয়, worker ব্যাকগ্রাউন্ডে প্রসেস করে —
// এতে request timeout হয় না।
export async function startImport(formData: FormData): Promise<StartImportResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: "workspace পাওয়া যায়নি" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "একটা CSV বা Excel ফাইল বাছাই করুন" };
  }
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return { error: `ফাইল সাইজ সর্বোচ্চ ${MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024)}MB হতে পারবে` };
  }

  const tag = String(formData.get("tag") ?? "").trim() || null;

  const buffer = await file.arrayBuffer();
  const { rows, phoneKey, nameKey } = parseContactFile(buffer);

  if (rows.length === 0) {
    return { error: "ফাইলে কোনো ডাটা পাওয়া যায়নি" };
  }

  const admin = createAdminClient();

  if (rows.length <= SYNC_IMPORT_ROW_THRESHOLD) {
    const { valid, invalidCount, duplicateInFileCount } = normalizeContactRows(rows, phoneKey, nameKey);
    const { addedCount, duplicateCount } = await upsertContactsBatched(admin, membership.workspace_id, valid, tag);

    await admin.from("contact_imports").insert({
      workspace_id: membership.workspace_id,
      file_name: file.name,
      status: "done",
      total_rows: rows.length,
      processed_rows: valid.length,
      added_count: addedCount,
      duplicate_count: duplicateCount + duplicateInFileCount,
      invalid_count: invalidCount,
      applied_tag: tag,
      completed_at: new Date().toISOString(),
    });

    return {
      error: null,
      done: true,
      added: addedCount,
      duplicate: duplicateCount + duplicateInFileCount,
      invalid: invalidCount,
    };
  }

  // বড় ফাইল: storage এ রাখা হচ্ছে, worker ওখান থেকে ডাউনলোড করে প্রসেস করবে
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "csv";
  const { data: importRow, error: insertError } = await admin
    .from("contact_imports")
    .insert({
      workspace_id: membership.workspace_id,
      file_name: file.name,
      status: "pending",
      total_rows: rows.length,
      applied_tag: tag,
    })
    .select("id")
    .single();

  if (insertError || !importRow) {
    return { error: insertError?.message ?? "import শুরু করা যায়নি" };
  }

  const storagePath = `${membership.workspace_id}/${importRow.id}.${ext}`;

  const { error: uploadError } = await admin.storage.from(CONTACT_IMPORTS_BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
  });

  if (uploadError) {
    await admin.from("contact_imports").update({ status: "failed", error_message: uploadError.message }).eq(
      "id",
      importRow.id
    );
    return { error: `ফাইল আপলোড ব্যর্থ: ${uploadError.message}` };
  }

  await admin.from("contact_imports").update({ storage_path: storagePath }).eq("id", importRow.id);

  await getContactImportQueue().add("import", { importJobId: importRow.id });

  return { error: null, done: false, importJobId: importRow.id as string };
}
