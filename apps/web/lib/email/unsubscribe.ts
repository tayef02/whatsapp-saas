import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken, type UnsubscribePayload } from "@whatsapp-saas/core/email/tokens";

// পাবলিক আনসাবস্ক্রাইব পেজ ও one-click রুটের শেয়ার্ড লজিক।
// লগে কখনো টোকেন/ইমেইল ছাপা হয় না (টোকেনে ইমেইল ঠিকানা থাকে)।

export function readUnsubscribeToken(token: string): UnsubscribePayload | null {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) {
    console.error("[unsubscribe] EMAIL_UNSUBSCRIBE_SECRET সেট করা নেই");
    return null;
  }
  return verifyUnsubscribeToken(secret, token);
}

// সফল হলে true (নতুন হোক বা আগেই করা থাকুক — প্রাপককে সবসময় একই ফল দেখানো হয়)।
// DB এরর হলে false, যাতে প্রাপক "সফল" দেখে ভুল ধারণা না পায়
export async function unsubscribeByToken(payload: UnsubscribePayload, source: "unsubscribe_link" | "one_click"): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("unsubscribe_email", {
    p_workspace_id: payload.workspaceId,
    p_email: payload.email,
    p_campaign_id: payload.campaignId,
    p_source: source,
  });
  if (error) {
    console.error("[unsubscribe] unsubscribe_email ব্যর্থ:", error.message);
    return false;
  }
  return true;
}
