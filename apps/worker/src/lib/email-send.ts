import { getEmailProvider } from "@whatsapp-saas/core/providers/email";
import { EmailProviderError, type SendEmailInput } from "@whatsapp-saas/core/providers/email-types";
import {
  readProviderLimits,
  SYSTEM_EMAIL_DAILY_LIMIT_PER_WORKSPACE,
  TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE,
} from "@whatsapp-saas/core/email/limits";
import { getSupabase } from "./supabase";

export type EmailLimitReason = "provider_daily_limit" | "provider_monthly_limit" | "workspace_daily_limit";

export class EmailLimitError extends Error {
  constructor(public reason: EmailLimitReason) {
    super(`ইমেইল সীমা ছুঁয়েছে: ${reason}`);
    this.name = "EmailLimitError";
  }
}

export const limitReasonText: Record<EmailLimitReason, string> = {
  provider_daily_limit: "আজকের মোট ইমেইল পাঠানোর সীমা শেষ — কাল আবার চেষ্টা করুন",
  provider_monthly_limit: "এই মাসের মোট ইমেইল পাঠানোর সীমা শেষ",
  workspace_daily_limit: "আজকের জন্য আপনার টেস্ট/সিস্টেম ইমেইলের সীমা শেষ",
};

// টেস্ট ও সিস্টেম (Reply-To কনফার্মেশন) ইমেইল পাঠানোর একমাত্র পথ — সীমা দেখে, email_send_log এ
// জায়গা রিজার্ভ করে, তারপর পাঠায়। (ক্যাম্পেইনের ইমেইল ফেজ ৩ এ scheduler + record_email_sent() দিয়ে
// যাবে; সেখানে এই গণনা DB ফাংশনে advisory lock এর ভেতরে হবে। এখানে ভলিউম খুব কম — দিনে মাত্র
// কয়েকটা — তাই count-তারপর-insert এ খুব সামান্য ওভারশুটের সম্ভাবনা মেনে নেওয়া হয়েছে।)
//
// সীমা rolling: দৈনিক = গত ২৪ ঘণ্টা, মাসিক = গত ৩০ দিন (কনজার্ভেটিভ — Resend ঠিক কখন রিসেট করে
// নিশ্চিত না)।
export async function sendEmailWithLimits(args: {
  kind: "test" | "system";
  workspaceId: string;
  input: SendEmailInput;
}): Promise<{ providerMessageId: string }> {
  const supabase = getSupabase();
  const provider = getEmailProvider();
  const limits = readProviderLimits();

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const countSince = async (since: string, extra?: { workspaceId: string; kind: string }) => {
    let query = supabase.from("email_send_log").select("id", { count: "exact", head: true }).eq("provider", provider.name).gte("sent_at", since);
    if (extra) query = query.eq("workspace_id", extra.workspaceId).eq("kind", extra.kind);
    const { count, error } = await query;
    if (error) throw new Error(`send_log গণনা ব্যর্থ: ${error.message}`);
    return count ?? 0;
  };

  if ((await countSince(dayAgo)) >= limits.daily) throw new EmailLimitError("provider_daily_limit");
  if ((await countSince(monthAgo)) >= limits.monthly) throw new EmailLimitError("provider_monthly_limit");

  const workspaceCap = args.kind === "test" ? TEST_EMAIL_DAILY_LIMIT_PER_WORKSPACE : SYSTEM_EMAIL_DAILY_LIMIT_PER_WORKSPACE;
  if ((await countSince(dayAgo, { workspaceId: args.workspaceId, kind: args.kind })) >= workspaceCap) {
    throw new EmailLimitError("workspace_daily_limit");
  }

  // আগে জায়গা রিজার্ভ, তারপর পাঠানো — পাঠানোর মাঝখানে কিছু ঘটলে অন্তত গণনা কম হয় না
  const { data: reserved, error: reserveError } = await supabase
    .from("email_send_log")
    .insert({ provider: provider.name, kind: args.kind, workspace_id: args.workspaceId })
    .select("id")
    .single();
  if (reserveError || !reserved) throw new Error(`send_log রিজার্ভ ব্যর্থ: ${reserveError?.message ?? "unknown"}`);

  try {
    return await provider.send(args.input);
  } catch (err) {
    // ইমেইল নিশ্চিতভাবে যায়নি (প্রোভাইডার গ্রহণই করেনি) হলে রিজার্ভেশন ছেড়ে দেওয়া হয়। transient এ
    // (timeout) ইমেইল গিয়েও থাকতে পারে — গণনা রেখে দেওয়া হয় (বেশি-গোনা নিরাপদ দিক)
    if (err instanceof EmailProviderError && err.kind !== "transient") {
      await supabase.from("email_send_log").delete().eq("id", reserved.id);
    }
    throw err;
  }
}
