"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@whatsapp-saas/core/providers/email";
import { EmailProviderError } from "@whatsapp-saas/core/providers/email-types";
import { refreshEmailDomain } from "@whatsapp-saas/core/email/domain-status";

// সার্ভার-সাইডে আবার super admin কিনা যাচাই — শুধু page-এর UI গেটের উপর ভরসা না করে
async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (!isSuperAdmin) throw new Error("অনুমতি নেই");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}

function errorMessage(err: unknown): string {
  if (err instanceof EmailProviderError) return err.message;
  return err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে";
}

const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// বিটায় একটাই প্ল্যাটফর্ম ডোমেইন (workspace_id = null) — সাবডোমেইন সুপারিশ (যেমন mail.example.com),
// যাতে মূল ডোমেইনের সুনাম আলাদা থাকে
export async function addPlatformDomain(formData: FormData) {
  try {
    await assertSuperAdmin();

    const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
    const fromLocal = String(formData.get("fromLocal") ?? "hello").trim().toLowerCase() || "hello";
    if (!DOMAIN_PATTERN.test(domain)) return { error: "ডোমেইনের নাম সঠিক নয় (যেমন mail.example.com)" };
    if (!/^[a-z0-9._-]{1,40}$/.test(fromLocal)) return { error: "From ঠিকানার অংশ সঠিক নয় (যেমন hello)" };

    const admin = createAdminClient();
    const { data: existing } = await admin.from("email_domains").select("id").is("workspace_id", null).eq("is_active", true).maybeSingle();
    if (existing) return { error: "প্ল্যাটফর্ম ডোমেইন আগেই যোগ করা আছে" };

    const provider = getEmailProvider();
    const created = await provider.createDomain(domain);

    const { error } = await admin.from("email_domains").insert({
      workspace_id: null,
      domain,
      provider: provider.name,
      provider_domain_id: created.providerDomainId,
      status: "pending",
      spf_status: created.spf,
      dkim_status: created.dkim,
      dmarc_status: "missing",
      dns_records: created.records,
      from_local: fromLocal,
    });
    if (error) {
      // প্রোভাইডারে ডোমেইন তৈরি হয়ে গেছে কিন্তু আমাদের DB তে বসেনি — হারিয়ে না যেতে id জানানো হচ্ছে
      return { error: `ডোমেইন Resend এ তৈরি হয়েছে (id: ${created.providerDomainId}) কিন্তু সেভ করা যায়নি: ${error.message}` };
    }

    revalidatePath("/dashboard/admin/email");
    return { error: null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function verifyPlatformDomain(domainId: string) {
  try {
    await assertSuperAdmin();
    const admin = createAdminClient();
    const result = await refreshEmailDomain(admin, getEmailProvider(), domainId, true);

    revalidatePath("/dashboard/admin/email");
    if (result.errorCode) return { error: `প্রোভাইডার থেকে অবস্থা আনা যায়নি (${result.errorCode})`, status: result.currentStatus };
    return { error: null, status: result.currentStatus };
  } catch (err) {
    return { error: errorMessage(err), status: null };
  }
}

// ---- From নামের অনুমোদন ----

async function reviewFromName(workspaceId: string, approve: boolean) {
  const reviewerId = await assertSuperAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("email_sender_profiles")
    .select("requested_from_name, from_name_status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!profile || profile.from_name_status !== "pending_approval" || !profile.requested_from_name) {
    return { error: "এই অনুরোধ আর অপেক্ষমান নেই" };
  }

  const nowIso = new Date().toISOString();
  const update = approve
    ? { from_name: profile.requested_from_name, from_name_status: "approved", requested_from_name: null, from_name_block_reason: null }
    : { from_name_status: "rejected" };

  const { data: updated, error } = await admin
    .from("email_sender_profiles")
    .update({ ...update, from_name_reviewed_by: reviewerId, from_name_reviewed_at: nowIso, updated_at: nowIso })
    .eq("workspace_id", workspaceId)
    .eq("from_name_status", "pending_approval")
    .select("workspace_id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "এই অনুরোধ আগেই রিভিউ হয়ে গেছে" };

  await admin.from("notifications").insert({
    workspace_id: workspaceId,
    type: approve ? "email_from_name_approved" : "email_from_name_rejected",
    title: approve ? "আপনার From নাম অনুমোদিত হয়েছে" : "আপনার From নাম অনুমোদিত হয়নি",
    body: approve ? "এখন থেকে ইমেইলে এই নামটি ব্যবহার হবে।" : "অন্য একটা নাম দিয়ে ইমেইল সেটআপ পেজ থেকে আবার চেষ্টা করুন।",
    channel: "email",
  });

  revalidatePath("/dashboard/admin/email");
  return { error: null };
}

export async function approveFromName(workspaceId: string) {
  try {
    return await reviewFromName(workspaceId, true);
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function rejectFromName(workspaceId: string) {
  try {
    return await reviewFromName(workspaceId, false);
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
