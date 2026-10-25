"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailJobsQueue } from "@/lib/queue/email-queues";
import { notifySuperAdminsEmail } from "@/lib/email/notify-super-admins";
import { checkBlockedFromName, validateFromNameFormat } from "@whatsapp-saas/core/email/from-name";
import { getEmailReadiness } from "@whatsapp-saas/core/email/readiness";
import { REPLY_TO_CONFIRMATION_COOLDOWN_SECONDS, TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE } from "@whatsapp-saas/core/email/limits";

type ActionResult = { error: string | null; notice?: string | null };

const EMAIL_PATTERN = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

// ইমেইল সেটআপ বদলাতে পারে শুধু workspace এর owner/admin। লেখা service_role দিয়ে হয় (ব্লক-তালিকা
// এড়িয়ে ব্রাউজার থেকে সরাসরি লেখা ঠেকাতে টেবিলে authenticated এর শুধু SELECT আছে), তাই role
// যাচাই এখানেই, সার্ভারে।
async function getAdminContext(): Promise<{ workspaceId: string; userEmail: string | null } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const { data: membership } = await supabase.from("workspace_members").select("workspace_id, role").limit(1).maybeSingle();
  if (!membership) return { error: "workspace পাওয়া যায়নি" };
  if (membership.role !== "owner" && membership.role !== "admin") return { error: "শুধু মালিক বা অ্যাডমিন ইমেইল সেটআপ বদলাতে পারবেন" };

  return { workspaceId: membership.workspace_id, userEmail: user.email ?? null };
}

// Reply-To কনফার্মেশন মেইলের অনুরোধ: cooldown এর মধ্যে থাকলে বসে না। cooldown "দাবি" একটা
// শর্তসহ UPDATE দিয়ে (দুটো ক্লিক একসাথে এলেও একটাই পাস করে)।
async function requestReplyToConfirmation(workspaceId: string): Promise<{ queued: boolean; error?: string }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - REPLY_TO_CONFIRMATION_COOLDOWN_SECONDS * 1000).toISOString();

  const { data: claimed, error } = await admin
    .from("email_sender_profiles")
    .update({ reply_to_confirmation_sent_at: nowIso })
    .eq("workspace_id", workspaceId)
    .not("reply_to_email", "is", null)
    .is("reply_to_verified_at", null)
    .or(`reply_to_confirmation_sent_at.is.null,reply_to_confirmation_sent_at.lt.${cutoff}`)
    .select("workspace_id");

  if (error) return { queued: false, error: error.message };
  if (!claimed || claimed.length === 0) return { queued: false };

  try {
    await getEmailJobsQueue().add(
      "reply-to-confirmation",
      { workspaceId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
        jobId: `email_replyto_${workspaceId}_${Math.floor(Date.now() / 60000)}`,
      }
    );
  } catch (err) {
    console.error("[email settings] reply-to job বসানো ব্যর্থ:", err instanceof Error ? err.message : err);
    return { queued: false, error: "কনফার্মেশন মেইল কিউতে বসানো যায়নি, একটু পরে আবার চেষ্টা করুন" };
  }
  return { queued: true };
}

export async function saveSenderProfile(formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if ("error" in ctx) return { error: ctx.error };

  const nameCheck = validateFromNameFormat(String(formData.get("fromName") ?? ""));
  if (!nameCheck.ok) return { error: nameCheck.error };
  const name = nameCheck.name;

  const replyTo = String(formData.get("replyTo") ?? "").trim().toLowerCase();
  if (replyTo.length > 254 || !EMAIL_PATTERN.test(replyTo)) return { error: "Reply-To ইমেইল ঠিকানা সঠিক নয়" };

  const businessName = String(formData.get("businessName") ?? "").trim();
  if (businessName.length < 1 || businessName.length > 120) return { error: "ব্যবসার নাম দিন (সর্বোচ্চ ১২০ অক্ষর)" };

  const postalAddress = String(formData.get("postalAddress") ?? "").trim();
  if (postalAddress.length < 1 || postalAddress.length > 300) return { error: "ব্যবসার ঠিকানা দিন (সর্বোচ্চ ৩০০ অক্ষর)" };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("email_sender_profiles").select("*").eq("workspace_id", ctx.workspaceId).maybeSingle();

  const changes: Record<string, unknown> = {};
  const notices: string[] = [];
  let newPendingName = false;

  if (name === existing?.from_name) {
    // সক্রিয় নামই আছে — আগের কোনো অমীমাংসিত/বাতিল অনুরোধ থাকলে মুছে দেওয়া
    if (existing.from_name_status !== "approved") {
      changes.from_name_status = "approved";
      changes.requested_from_name = null;
      changes.from_name_block_reason = null;
    }
  } else if (name === existing?.requested_from_name && existing?.from_name_status === "pending_approval") {
    notices.push("From নামটি এখনো সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে");
  } else {
    const block = checkBlockedFromName(name);
    if (block.blocked) {
      // ব্লক-তালিকার শব্দ — সক্রিয় নাম বদলায় না, অনুরোধ হিসেবে জমা থাকে (রিভিউযোগ্য রো)
      changes.requested_from_name = name;
      changes.from_name_status = "pending_approval";
      changes.from_name_block_reason = `blocked_term:${block.term}`;
      changes.from_name_reviewed_by = null;
      changes.from_name_reviewed_at = null;
      newPendingName = true;
      notices.push(`"${block.term}" শব্দটি সংরক্ষিত তালিকায় আছে, তাই From নামটি এখনই চালু হয়নি — সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় জমা হয়েছে`);
    } else {
      changes.from_name = name;
      changes.from_name_status = "approved";
      changes.requested_from_name = null;
      changes.from_name_block_reason = null;
    }
  }

  const replyChanged = replyTo !== (existing?.reply_to_email ?? "").toLowerCase();
  if (replyChanged) {
    changes.reply_to_email = replyTo;
    changes.reply_to_verified_at = null;
  }

  const { error } = await admin.from("email_sender_profiles").upsert(
    {
      workspace_id: ctx.workspaceId,
      business_name: businessName,
      postal_address: postalAddress,
      ...changes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );
  if (error) return { error: error.message };

  if (newPendingName) {
    await notifySuperAdminsEmail("email_from_name_pending", "একটি From নাম অনুমোদনের অপেক্ষায়", "ইমেইল অ্যাডমিন পেজে গিয়ে অনুমোদন বা বাতিল করুন।");
  }

  if (replyChanged) {
    const result = await requestReplyToConfirmation(ctx.workspaceId);
    if (result.error) notices.push(result.error);
    else if (result.queued) notices.push(`${replyTo} ঠিকানায় কনফার্মেশন মেইল পাঠানো হচ্ছে — মেইলের লিংকে ক্লিক করুন`);
    else notices.push("কনফার্মেশন মেইল একটু আগেই পাঠানো হয়েছে, ১ মিনিট পর 'আবার পাঠান' চাপুন");
  }

  revalidatePath("/dashboard/email");
  return { error: null, notice: notices.length > 0 ? notices.join(" · ") : null };
}

export async function resendReplyToConfirmation(): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if ("error" in ctx) return { error: ctx.error };

  const result = await requestReplyToConfirmation(ctx.workspaceId);
  if (result.error) return { error: result.error };
  if (!result.queued) return { error: "এখন পাঠানো যাচ্ছে না — ১ মিনিট অপেক্ষা করুন, অথবা ঠিকানা ইতিমধ্যে যাচাই হয়ে গেছে" };

  return { error: null, notice: "কনফার্মেশন মেইল পাঠানো হচ্ছে — কয়েক মিনিটের মধ্যে ইনবক্স (স্প্যামসহ) দেখুন" };
}

// নিজের অ্যাকাউন্টের ইমেইলে একটা টেস্ট ইমেইল (অন্য কোনো ঠিকানায় না — অপব্যবহার ঠেকাতে)
export async function sendTestEmail(): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if ("error" in ctx) return { error: ctx.error };
  if (!ctx.userEmail) return { error: "আপনার অ্যাকাউন্টে ইমেইল ঠিকানা পাওয়া যায়নি" };

  const admin = createAdminClient();
  const [{ data: domain }, { data: profile }] = await Promise.all([
    admin.from("email_domains").select("status, is_active").is("workspace_id", null).eq("is_active", true).maybeSingle(),
    admin.from("email_sender_profiles").select("from_name, reply_to_email, reply_to_verified_at, business_name, postal_address").eq("workspace_id", ctx.workspaceId).maybeSingle(),
  ]);

  const readiness = getEmailReadiness(domain, profile);
  if (!readiness.ready) return { error: "সেটআপ চেকলিস্ট এখনো সম্পূর্ণ হয়নি — আগে সবগুলো ধাপ সম্পন্ন করুন" };

  // দ্রুত ফিডব্যাকের জন্য এখানেও দৈনিক সীমা দেখা হয় (worker এও আবার যাচাই হয়)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId)
    .eq("kind", "test")
    .gte("sent_at", since);
  if ((count ?? 0) >= TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE) {
    return { error: `২৪ ঘণ্টায় সর্বোচ্চ ${TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE}টা টেস্ট ইমেইল পাঠানো যায়` };
  }

  try {
    await getEmailJobsQueue().add(
      "test-send",
      { workspaceId: ctx.workspaceId, toEmail: ctx.userEmail },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 100, jobId: `email_test_${ctx.workspaceId}_${Date.now()}` }
    );
  } catch (err) {
    console.error("[email settings] test-send job বসানো ব্যর্থ:", err instanceof Error ? err.message : err);
    return { error: "টেস্ট ইমেইল কিউতে বসানো যায়নি, একটু পরে আবার চেষ্টা করুন" };
  }

  return { error: null, notice: "টেস্ট ইমেইল পাঠানো হচ্ছে — কয়েক মিনিটের মধ্যে আপনার ইনবক্স (স্প্যামসহ) দেখুন" };
}
