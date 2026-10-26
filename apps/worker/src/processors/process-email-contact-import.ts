import { getSupabase } from "../lib/supabase";
import { parseEmailContactFile } from "@whatsapp-saas/core/email/parse-contacts";
import { runEmailContactImport } from "@whatsapp-saas/core/email/import-contacts";
import { EMAIL_IMPORTS_BUCKET } from "@whatsapp-saas/core/email/constants";

// বড় ইমেইল-কন্টাক্ট ফাইল ব্যাকগ্রাউন্ডে প্রসেস করে — storage থেকে ফাইল নামিয়ে, web এর ছোট-ফাইল পথের
// একই কোড (runEmailContactImport) চালায়। লগে কখনো ইমেইল ঠিকানা ছাপা হয় না।
export async function processEmailContactImport(data: { importJobId: string }) {
  const supabase = getSupabase();
  const { importJobId } = data;

  const { data: importRow, error: fetchError } = await supabase
    .from("email_contact_imports")
    .select("workspace_id, storage_path, applied_tag, consent_confirmed_by")
    .eq("id", importJobId)
    .single();

  if (fetchError || !importRow) {
    console.error(`[email-contact-import] job ${importJobId} এর row পাওয়া যায়নি`, fetchError?.message);
    return;
  }

  if (!importRow.storage_path) {
    await supabase.from("email_contact_imports").update({ status: "failed", error_message: "storage_path নেই" }).eq("id", importJobId);
    return;
  }

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from(EMAIL_IMPORTS_BUCKET).download(importRow.storage_path);
    if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? "ফাইল ডাউনলোড ব্যর্থ");

    const { rows, emailKey, nameKey } = parseEmailContactFile(await fileBlob.arrayBuffer());
    if (!emailKey) throw new Error("ফাইলে ইমেইল কলাম পাওয়া যায়নি (হেডার: email বা ইমেইল)");

    const summary = await runEmailContactImport(supabase, {
      workspaceId: importRow.workspace_id,
      importId: importJobId,
      consentedBy: importRow.consent_confirmed_by,
      tag: importRow.applied_tag,
      rows,
      emailKey,
      nameKey,
    });
    console.log(`[email-contact-import] ${importJobId} শেষ — যোগ ${summary.added}, ডুপ্লিকেট ${summary.duplicate}, ইনভ্যালিড ${summary.invalid}, ব্লক ${summary.suppressed}`);

    await supabase.storage.from(EMAIL_IMPORTS_BUCKET).remove([importRow.storage_path]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "অজানা এরর";
    console.error(`[email-contact-import] ${importJobId} ব্যর্থ:`, message);
    await supabase.from("email_contact_imports").update({ status: "failed", error_message: message }).eq("id", importJobId);
  }
}
