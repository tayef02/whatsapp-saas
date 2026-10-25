import type { Job } from "bullmq";
import { EmailProviderError } from "@whatsapp-saas/core/providers/email-types";
import { appendEmailFooter, buildListUnsubscribeHeaders, buildUnsubscribeUrls } from "@whatsapp-saas/core/email/compose";
import { createReplyToToken, createUnsubscribeToken, REPLY_TO_TOKEN_TTL_MS } from "@whatsapp-saas/core/email/tokens";
import { getEmailReadiness } from "@whatsapp-saas/core/email/readiness";
import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import { notifySuperAdminsEmail } from "../lib/email-notify";
import { EmailLimitError, limitReasonText, sendEmailWithLimits } from "../lib/email-send";

// লগে কখনো প্রাপকের ঠিকানা, টোকেন-URL, API key ছাপা হয় না।

interface TestSendJob {
  workspaceId: string;
  toEmail: string;
}

interface ReplyToJob {
  workspaceId: string;
}

// অ্যাপের পাবলিক URL ও টোকেন-সিক্রেট ছাড়া লিংক বানানো যায় না — ছাড়া পাঠানোই বন্ধ
function readLinkConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = process.env.APP_PUBLIC_URL;
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!baseUrl || !secret || !(baseUrl.startsWith("https://") || baseUrl.startsWith("http://"))) return null;
  return { baseUrl, secret };
}

async function loadPlatformDomain() {
  const { data } = await getSupabase()
    .from("email_domains")
    .select("domain, from_local, status, is_active")
    .is("workspace_id", null)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

// প্রোভাইডার এরর → সিদ্ধান্ত: retry যোগ্য হলে throw (BullMQ আবার চেষ্টা করবে), নাহলে ইউজারকে নোটিফিকেশন
async function handleSendFailure(err: unknown, workspaceId: string, what: string): Promise<void> {
  if (err instanceof EmailLimitError) {
    await createNotification(workspaceId, "email_send_blocked", `${what} পাঠানো যায়নি`, "email", limitReasonText[err.reason]);
    return;
  }
  if (err instanceof EmailProviderError) {
    if (err.kind === "rate_limited" || err.kind === "transient") throw err;
    if (err.kind === "auth") {
      console.error(`[email-jobs] প্রোভাইডার auth ব্যর্থ (${what})`);
      await notifySuperAdminsEmail("email_provider_auth", "ইমেইল প্রোভাইডারের API key কাজ করছে না", "RESEND_API_KEY যাচাই করুন (Full access key লাগবে)।");
      await createNotification(workspaceId, "email_send_failed", `${what} পাঠানো যায়নি`, "email", "সিস্টেমে সমস্যা আছে — সাপোর্টে জানান।");
      return;
    }
    await createNotification(workspaceId, "email_send_failed", `${what} পাঠানো যায়নি`, "email", err.message);
    return;
  }
  throw err;
}

export async function processEmailTestSend(job: Job<TestSendJob>): Promise<void> {
  const { workspaceId, toEmail } = job.data;
  const supabase = getSupabase();

  const [domain, { data: profile }] = await Promise.all([
    loadPlatformDomain(),
    supabase
      .from("email_sender_profiles")
      .select("from_name, reply_to_email, reply_to_verified_at, business_name, postal_address")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  // পাঠানোর ঠিক আগে আবার গেট (সারিতে থাকার সময় ডোমেইন ভেঙে গেলে বা তথ্য বদলালে)
  const readiness = getEmailReadiness(domain, profile);
  if (!domain || !profile || !readiness.ready) {
    await createNotification(workspaceId, "email_send_blocked", "টেস্ট ইমেইল পাঠানো যায়নি", "email", "ইমেইল সেটআপ চেকলিস্ট সম্পূর্ণ নেই বা ডোমেইন যাচাই ভেঙে গেছে।");
    return;
  }

  const config = readLinkConfig();
  if (!config) {
    console.error("[email-jobs] APP_PUBLIC_URL / EMAIL_UNSUBSCRIBE_SECRET সেট নেই — টেস্ট ইমেইল বাতিল");
    await createNotification(workspaceId, "email_send_failed", "টেস্ট ইমেইল পাঠানো যায়নি", "email", "সার্ভার কনফিগারেশন অসম্পূর্ণ — সাপোর্টে জানান।");
    return;
  }

  const token = createUnsubscribeToken(config.secret, { workspaceId, email: toEmail, campaignId: null });
  const urls = buildUnsubscribeUrls(config.baseUrl, token);

  const body = appendEmailFooter({
    html: `<p>আসসালামু আলাইকুম,</p><p>এটি একটি <b>টেস্ট ইমেইল</b>। আপনার ইমেইল সেটআপ ঠিকমতো কাজ করছে।</p><p>Hello, this is a test email — your email setup is working.</p>`,
    text: `আসসালামু আলাইকুম,\n\nএটি একটি টেস্ট ইমেইল। আপনার ইমেইল সেটআপ ঠিকমতো কাজ করছে।\n\nHello, this is a test email — your email setup is working.`,
    urls,
    businessName: profile.business_name!,
    postalAddress: profile.postal_address!,
  });

  try {
    await sendEmailWithLimits({
      kind: "test",
      workspaceId,
      input: {
        from: { name: profile.from_name!, address: `${domain.from_local}@${domain.domain}` },
        to: toEmail,
        replyTo: profile.reply_to_email!,
        subject: "টেস্ট ইমেইল / Test email",
        html: body.html,
        text: body.text,
        headers: buildListUnsubscribeHeaders(urls),
        tags: { ws: workspaceId, kind: "test" },
        idempotencyKey: `email_test_${job.id}`,
      },
    });
    console.log(`[email-jobs] টেস্ট ইমেইল পাঠানো হয়েছে (workspace=${workspaceId})`);
  } catch (err) {
    await handleSendFailure(err, workspaceId, "টেস্ট ইমেইল");
  }
}

export async function processReplyToConfirmation(job: Job<ReplyToJob>): Promise<void> {
  const { workspaceId } = job.data;
  const supabase = getSupabase();

  const { data: profile } = await supabase
    .from("email_sender_profiles")
    .select("reply_to_email, reply_to_verified_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  // ইতিমধ্যে যাচাই হয়ে গেছে বা ঠিকানাই নেই — কিছু করার নেই
  if (!profile?.reply_to_email || profile.reply_to_verified_at) return;

  const domain = await loadPlatformDomain();
  if (!domain || domain.status !== "verified") {
    // ডোমেইন যাচাইয়ের আগে সেটআপ করলে এটা স্বাভাবিক — ইউজারকে জানানো হয় (চুপচাপ বাদ না পড়ে)
    await createNotification(
      workspaceId,
      "email_send_blocked",
      "Reply-To কনফার্মেশন মেইল পাঠানো যায়নি",
      "email",
      "প্ল্যাটফর্ম ইমেইল ডোমেইন এখনো যাচাই হয়নি। যাচাই হলে ইমেইল সেটআপ পেজ থেকে 'কনফার্মেশন মেইল আবার পাঠান' চাপুন।"
    );
    return;
  }

  const config = readLinkConfig();
  if (!config) {
    console.error("[email-jobs] APP_PUBLIC_URL / EMAIL_UNSUBSCRIBE_SECRET সেট নেই — কনফার্মেশন মেইল বাতিল");
    await createNotification(workspaceId, "email_send_failed", "Reply-To কনফার্মেশন মেইল পাঠানো যায়নি", "email", "সার্ভার কনফিগারেশন অসম্পূর্ণ — সাপোর্টে জানান।");
    return;
  }

  const token = createReplyToToken(config.secret, {
    workspaceId,
    email: profile.reply_to_email,
    expiresAt: Date.now() + REPLY_TO_TOKEN_TTL_MS,
  });
  const link = `${config.baseUrl.replace(/\/+$/, "")}/e/reply-to/${token}`;

  try {
    await sendEmailWithLimits({
      kind: "system",
      workspaceId,
      input: {
        // সিস্টেম মেইল — workspace এর From নাম না, প্ল্যাটফর্মের নিজের নামে
        from: { name: "Gen Z CRM", address: `${domain.from_local}@${domain.domain}` },
        to: profile.reply_to_email,
        subject: "Reply-To ঠিকানা নিশ্চিত করুন / Confirm your Reply-To address",
        html:
          `<p>আসসালামু আলাইকুম,</p>` +
          `<p>Gen Z CRM-এ একটি ওয়ার্কস্পেসের Reply-To ঠিকানা হিসেবে এই ইমেইল দেওয়া হয়েছে। নিশ্চিত করতে নিচের লিংকে ক্লিক করুন (২৪ ঘণ্টা বৈধ):</p>` +
          `<p><a href="${link}">ঠিকানা নিশ্চিত করুন / Confirm address</a></p>` +
          `<p style="color:#6b7280;font-size:12px">আপনি এটি চাননি? এই ইমেইল উপেক্ষা করুন। / If you did not request this, ignore this email.</p>`,
        text:
          `আসসালামু আলাইকুম,\n\nGen Z CRM-এ একটি ওয়ার্কস্পেসের Reply-To ঠিকানা হিসেবে এই ইমেইল দেওয়া হয়েছে। নিশ্চিত করতে লিংকে যান (২৪ ঘণ্টা বৈধ):\n${link}\n\n` +
          `আপনি এটি চাননি? উপেক্ষা করুন। / If you did not request this, ignore this email.`,
        tags: { ws: workspaceId, kind: "system" },
        idempotencyKey: `email_replyto_${job.id}`,
      },
    });
    console.log(`[email-jobs] Reply-To কনফার্মেশন পাঠানো হয়েছে (workspace=${workspaceId})`);
  } catch (err) {
    await handleSendFailure(err, workspaceId, "Reply-To কনফার্মেশন মেইল");
  }
}
