"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailMemberContext } from "@/lib/email/member-context";
import { getEmailContactImportQueue } from "@/lib/queue/email-queues";
import { parseEmailContactFile } from "@whatsapp-saas/core/email/parse-contacts";
import { runEmailContactImport } from "@whatsapp-saas/core/email/import-contacts";
import { IMPORT_CONSENT_TEXT, IMPORT_CONSENT_TEXT_VERSION } from "@whatsapp-saas/core/email/consent";
import {
  EMAIL_IMPORTS_BUCKET,
  EMAIL_MAX_IMPORT_FILE_SIZE_BYTES,
  EMAIL_SYNC_IMPORT_ROW_THRESHOLD,
  EMAIL_TAG_MAX_LENGTH,
} from "@whatsapp-saas/core/email/constants";

type StartResult = { error: string; importId?: undefined } | { error: null; importId: string };

// ইমেইল কন্টাক্ট ইম্পোর্ট শুরু। ক্রম: সম্মতি-চেকবক্স যাচাই (না থাকলে কিছুই হয় না) → ফাইল যাচাই →
// সম্মতির রেকর্ডসহ ইম্পোর্ট রো তৈরি → ছোট ফাইল সাথে সাথে, বড় ফাইল storage + queue দিয়ে worker এ।
// সবশেষে ইম্পোর্টের সারাংশ পেজে যায় (সেখানে যোগ/স্কিপ ও কারণ দেখা যায়)।
export async function startEmailImport(formData: FormData): Promise<StartResult> {
  const ctx = await getEmailMemberContext();
  if ("error" in ctx) return { error: ctx.error };
  if (!ctx.userEmail) return { error: "আপনার অ্যাকাউন্টে ইমেইল ঠিকানা নেই — সম্মতির রেকর্ড রাখা যাচ্ছে না" };

  // ১) সম্মতি — সার্ভারেই আবার চেক (ব্রাউজারের required এর উপর ভরসা না করে)
  if (formData.get("consent") !== "on") {
    return { error: "সম্মতি নিশ্চিত করে টিক দিন — এটা ছাড়া ইম্পোর্ট করা যাবে না" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "একটা CSV বা Excel ফাইল বাছাই করুন" };
  if (file.size > EMAIL_MAX_IMPORT_FILE_SIZE_BYTES) {
    return { error: `ফাইল সাইজ সর্বোচ্চ ${EMAIL_MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024)}MB হতে পারবে` };
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(ext)) return { error: "শুধু CSV বা Excel (.xlsx, .xls) ফাইল চলবে" };

  const tag = String(formData.get("tag") ?? "").trim();
  if (tag.length > EMAIL_TAG_MAX_LENGTH) return { error: `ট্যাগ সর্বোচ্চ ${EMAIL_TAG_MAX_LENGTH} অক্ষর` };

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseEmailContactFile(buffer);
  } catch {
    return { error: "ফাইলটা পড়া যায়নি — CSV বা Excel ফাইল কিনা দেখুন" };
  }
  const { rows, emailKey, nameKey } = parsed;

  if (rows.length === 0) return { error: "ফাইলে কোনো ডাটা পাওয়া যায়নি" };
  if (!emailKey) return { error: "ইমেইল কলাম পাওয়া যায়নি — প্রথম সারিতে হেডার হিসেবে email বা ইমেইল লিখুন" };

  const admin = createAdminClient();

  // ২) সম্মতির রেকর্ডসহ ইম্পোর্ট রো (consent_* কলামগুলো NOT NULL — সম্মতি ছাড়া এই রো তৈরিই হয় না)
  const { data: importRow, error: insertError } = await admin
    .from("email_contact_imports")
    .insert({
      workspace_id: ctx.workspaceId,
      file_name: file.name.slice(0, 255),
      status: "pending",
      total_rows: rows.length,
      applied_tag: tag || null,
      consent_confirmed_at: new Date().toISOString(),
      consent_confirmed_by: ctx.userId,
      consent_confirmed_by_email: ctx.userEmail,
      consent_text: IMPORT_CONSENT_TEXT,
      consent_text_version: IMPORT_CONSENT_TEXT_VERSION,
    })
    .select("id")
    .single();

  if (insertError || !importRow) return { error: insertError?.message ?? "ইম্পোর্ট শুরু করা যায়নি" };
  const importId = importRow.id as string;

  const markFailed = async (message: string) => {
    await admin.from("email_contact_imports").update({ status: "failed", error_message: message }).eq("id", importId);
  };

  // ৩ক) ছোট ফাইল: এখনই
  if (rows.length <= EMAIL_SYNC_IMPORT_ROW_THRESHOLD) {
    try {
      await runEmailContactImport(admin, {
        workspaceId: ctx.workspaceId,
        importId,
        consentedBy: ctx.userId,
        tag: tag || null,
        rows,
        emailKey,
        nameKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ইম্পোর্ট ব্যর্থ";
      await markFailed(message);
      return { error: message };
    }
    revalidatePath("/dashboard/email/contacts");
    return { error: null, importId };
  }

  // ৩খ) বড় ফাইল: storage এ রেখে worker এ
  const storagePath = `${ctx.workspaceId}/${importId}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from(EMAIL_IMPORTS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) {
    await markFailed(uploadError.message);
    return { error: `ফাইল আপলোড ব্যর্থ: ${uploadError.message}` };
  }

  const { error: pathError } = await admin.from("email_contact_imports").update({ storage_path: storagePath }).eq("id", importId);
  if (pathError) {
    await markFailed(pathError.message);
    return { error: pathError.message };
  }

  try {
    await getEmailContactImportQueue().add("import", { importJobId: importId });
  } catch (err) {
    console.error("[email import] queue.add ব্যর্থ:", err instanceof Error ? err.message : err);
    await markFailed("প্রসেসিং কিউতে বসানো যায়নি");
    return { error: "প্রসেসিং কিউতে বসানো যায়নি, একটু পরে আবার চেষ্টা করুন" };
  }

  revalidatePath("/dashboard/email/contacts");
  return { error: null, importId };
}
