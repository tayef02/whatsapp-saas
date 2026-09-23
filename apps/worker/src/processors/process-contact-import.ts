import { getSupabase } from "../lib/supabase";
import { parseContactFile } from "@whatsapp-saas/core/contacts/parse";
import { normalizeContactRows } from "@whatsapp-saas/core/contacts/normalize-batch";
import { upsertContactsBatched } from "@whatsapp-saas/core/contacts/upsert";
import { CONTACT_IMPORTS_BUCKET } from "@whatsapp-saas/core/contacts/constants";

// বড় ফাইল ইম্পোর্ট ব্যাকগ্রাউন্ডে প্রসেস করে — storage থেকে ফাইল নামিয়ে,
// নরমালাইজ করে, ১০০০ করে ব্যাচে DB তে বসায়, আর প্রতি ব্যাচের পর progress আপডেট করে
export async function processContactImport(data: { importJobId: string }) {
  const supabase = getSupabase();
  const { importJobId } = data;

  const { data: importRow, error: fetchError } = await supabase
    .from("contact_imports")
    .select("workspace_id, storage_path, applied_tag")
    .eq("id", importJobId)
    .single();

  if (fetchError || !importRow) {
    console.error(`[contact-import] job ${importJobId} এর row পাওয়া যায়নি`, fetchError?.message);
    return;
  }

  const row = importRow as { workspace_id: string; storage_path: string | null; applied_tag: string | null };

  if (!row.storage_path) {
    await supabase
      .from("contact_imports")
      .update({ status: "failed", error_message: "storage_path নেই" })
      .eq("id", importJobId);
    return;
  }

  await supabase.from("contact_imports").update({ status: "processing" }).eq("id", importJobId);

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(CONTACT_IMPORTS_BUCKET)
      .download(row.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "ফাইল ডাউনলোড ব্যর্থ");
    }

    const buffer = await fileBlob.arrayBuffer();
    const { rows, phoneKey, nameKey } = parseContactFile(buffer);
    const { valid, invalidCount, duplicateInFileCount } = normalizeContactRows(rows, phoneKey, nameKey);

    const { addedCount, duplicateCount } = await upsertContactsBatched(
      supabase,
      row.workspace_id,
      valid,
      row.applied_tag,
      async (progress) => {
        await supabase
          .from("contact_imports")
          .update({
            processed_rows: progress.processedRows,
            added_count: progress.addedCount,
            duplicate_count: progress.duplicateCount + duplicateInFileCount,
          })
          .eq("id", importJobId);
      }
    );

    await supabase
      .from("contact_imports")
      .update({
        status: "done",
        processed_rows: valid.length,
        added_count: addedCount,
        duplicate_count: duplicateCount + duplicateInFileCount,
        invalid_count: invalidCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importJobId);

    await supabase.storage.from(CONTACT_IMPORTS_BUCKET).remove([row.storage_path]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "অজানা এরর";
    await supabase.from("contact_imports").update({ status: "failed", error_message: message }).eq("id", importJobId);
  }
}
