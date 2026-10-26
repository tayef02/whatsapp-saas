import type { RawContactRow } from "../contacts/parse";
import { normalizeEmail } from "./address";
import { EMAIL_IMPORT_BATCH_SIZE, EMAIL_SKIP_INSERT_BATCH_SIZE } from "./constants";

// web (ছোট ফাইল, সরাসরি) আর worker (বড় ফাইল) দুটোই এই একই কোড চালায় — আচরণ এক।
// supabase client এর পুরো টাইপ দরকার নেই
interface ImportDb {
  from(table: string): any;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }>;
}

export interface ValidEmailRow {
  row_no: number;
  email: string;
  name: string | null;
  custom_fields: Record<string, string>;
}

export interface EmailSkipRow {
  row_no: number;
  email: string | null;
  reason: "empty_email" | "invalid_format" | "duplicate_in_file";
}

const MAX_CUSTOM_FIELDS = 30;
const MAX_FIELD_KEY_LENGTH = 50;
const MAX_FIELD_VALUE_LENGTH = 500;
const MAX_NAME_LENGTH = 200;

// ফাইলের raw রো → বৈধ রো আর ফাইল-লেভেলে বাদ পড়া রো (ফাঁকা / ফরম্যাট ভুল / ফাইলে ডুপ্লিকেট)।
// সারি নম্বর: হেডার = ১, প্রথম ডাটা রো = ২ (ইউজার Excel এ যে নম্বর দেখে)। একই ঠিকানা একাধিকবার
// থাকলে প্রথমটা রাখা হয়।
export function prepareEmailRows(
  rows: RawContactRow[],
  emailKey: string,
  nameKey: string | null
): { valid: ValidEmailRow[]; skips: EmailSkipRow[] } {
  const valid: ValidEmailRow[] = [];
  const skips: EmailSkipRow[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const rawValue = String(row[emailKey] ?? "").trim();

    if (!rawValue) {
      skips.push({ row_no: rowNo, email: null, reason: "empty_email" });
      return;
    }

    const email = normalizeEmail(rawValue);
    if (!email) {
      skips.push({ row_no: rowNo, email: rawValue.slice(0, 320), reason: "invalid_format" });
      return;
    }

    if (seen.has(email)) {
      skips.push({ row_no: rowNo, email, reason: "duplicate_in_file" });
      return;
    }
    seen.add(email);

    const customFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === emailKey || key === nameKey) continue;
      const text = String(value ?? "").trim();
      if (!text || !key.trim() || Object.keys(customFields).length >= MAX_CUSTOM_FIELDS) continue;
      customFields[key.trim().slice(0, MAX_FIELD_KEY_LENGTH)] = text.slice(0, MAX_FIELD_VALUE_LENGTH);
    }

    const name = nameKey ? String(row[nameKey] ?? "").trim().slice(0, MAX_NAME_LENGTH) : "";
    valid.push({ row_no: rowNo, email, name: name || null, custom_fields: customFields });
  });

  return { valid, skips };
}

export interface EmailImportSummary {
  total: number;
  added: number;
  duplicate: number; // ফাইলের ভেতরের ডুপ্লিকেট + আগে থেকে তালিকায় থাকা
  invalid: number; // ফাঁকা বা ফরম্যাট ভুল
  suppressed: number;
}

function checkError(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// পুরো ইম্পোর্ট চালায়: ফাইল-লেভেল স্কিপ লেখা → ব্যাচে (EMAIL_IMPORT_BATCH_SIZE) DB ফাংশন কল (সেখানে
// suppression মেলানো, ডুপ্লিকেট বাদ, কন্টাক্ট বসানো) → প্রতি ব্যাচের পর প্রগ্রেস → শেষে সারাংশ।
// প্রতিটা DB কলের error চেক হয়; কোথাও ব্যর্থ হলে throw — কলার import রো "failed" করে।
// (আংশিক ব্যর্থতায় আগের ব্যাচের কন্টাক্ট থেকে যায়, আবার ইম্পোর্ট করলে সেগুলো "আগে থেকেই আছে" স্কিপ হবে।)
export async function runEmailContactImport(
  db: ImportDb,
  args: {
    workspaceId: string;
    importId: string;
    consentedBy: string;
    tag: string | null;
    rows: RawContactRow[];
    emailKey: string;
    nameKey: string | null;
  }
): Promise<EmailImportSummary> {
  const { workspaceId, importId, consentedBy, tag } = args;
  const { valid, skips } = prepareEmailRows(args.rows, args.emailKey, args.nameKey);

  // রিট্রাই হলে আগের চেষ্টার স্কিপ-রো ডুপ্লিকেট না হতে — এই ইম্পোর্টের পুরনো স্কিপ মুছে নতুন করে শুরু
  const cleared = await db.from("email_contact_skips").delete().eq("import_id", importId);
  checkError(cleared.error, "পুরনো স্কিপ মোছা ব্যর্থ");

  const started = await db
    .from("email_contact_imports")
    .update({ status: "processing", total_rows: args.rows.length, processed_rows: 0 })
    .eq("id", importId);
  checkError(started.error, "ইম্পোর্ট স্ট্যাটাস আপডেট ব্যর্থ");

  // ফাইল-লেভেল স্কিপ (ফাঁকা / ফরম্যাট ভুল / ফাইলের ডুপ্লিকেট) — ব্যাচে, প্রতিটা insert এর error চেক
  for (let i = 0; i < skips.length; i += EMAIL_SKIP_INSERT_BATCH_SIZE) {
    const batch = skips.slice(i, i + EMAIL_SKIP_INSERT_BATCH_SIZE).map((s) => ({
      workspace_id: workspaceId,
      import_id: importId,
      row_no: s.row_no,
      email: s.email,
      reason: s.reason,
    }));
    const inserted = await db.from("email_contact_skips").insert(batch);
    checkError(inserted.error, "স্কিপ রো লেখা ব্যর্থ");
  }

  let added = 0;
  let suppressed = 0;
  let alreadyInList = 0;
  let processed = skips.length;

  for (let i = 0; i < valid.length; i += EMAIL_IMPORT_BATCH_SIZE) {
    const batch = valid.slice(i, i + EMAIL_IMPORT_BATCH_SIZE);

    const { data, error } = await db.rpc("import_email_contacts_batch", {
      p_workspace_id: workspaceId,
      p_import_id: importId,
      p_consented_by: consentedBy,
      p_tag: tag,
      p_rows: batch,
    });
    checkError(error, "কন্টাক্ট ব্যাচ বসানো ব্যর্থ");

    added += Number(data?.added ?? 0);
    suppressed += Number(data?.suppressed ?? 0);
    alreadyInList += Number(data?.already_in_list ?? 0);
    processed += batch.length;

    const progress = await db
      .from("email_contact_imports")
      .update({ processed_rows: processed, added_count: added, suppressed_count: suppressed })
      .eq("id", importId);
    checkError(progress.error, "প্রগ্রেস আপডেট ব্যর্থ");
  }

  const invalid = skips.filter((s) => s.reason !== "duplicate_in_file").length;
  const duplicateInFile = skips.length - invalid;
  const summary: EmailImportSummary = {
    total: args.rows.length,
    added,
    duplicate: duplicateInFile + alreadyInList,
    invalid,
    suppressed,
  };

  const finished = await db
    .from("email_contact_imports")
    .update({
      status: "done",
      processed_rows: args.rows.length,
      added_count: summary.added,
      duplicate_count: summary.duplicate,
      invalid_count: summary.invalid,
      suppressed_count: summary.suppressed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);
  checkError(finished.error, "ইম্পোর্ট শেষ করার আপডেট ব্যর্থ");

  return summary;
}
