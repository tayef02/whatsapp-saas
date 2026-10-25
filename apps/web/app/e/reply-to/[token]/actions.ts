"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReplyToToken } from "@whatsapp-saas/core/email/tokens";

// Reply-To ঠিকানার মালিকানা প্রমাণ: ইমেইলের লিংকে ক্লিক করে বোতাম চাপলে reply_to_verified_at বসে।
// টোকেনের ইমেইল প্রোফাইলের বর্তমান ঠিকানার সাথে মিলতে হবে — মাঝখানে ঠিকানা বদলালে পুরনো লিংক অচল।
export async function confirmReplyTo(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const payload = secret ? verifyReplyToToken(secret, token) : null;
  if (!payload) redirect(`/e/reply-to/${encodeURIComponent(token)}`);

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("email_sender_profiles")
    .update({ reply_to_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("workspace_id", payload.workspaceId)
    .eq("reply_to_email", payload.email)
    .select("workspace_id");

  if (error) console.error("[reply-to confirm] আপডেট ব্যর্থ:", error.message);

  const ok = !error && (updated?.length ?? 0) > 0;
  redirect(`/e/reply-to/${encodeURIComponent(token)}?${ok ? "done=1" : "error=1"}`);
}
