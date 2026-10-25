import { getEmailProvider } from "@whatsapp-saas/core/providers/email";
import { refreshEmailDomain } from "@whatsapp-saas/core/email/domain-status";
import { getSupabase } from "../lib/supabase";
import { notifySuperAdminsEmail } from "../lib/email-notify";

// দিনে একবার: সক্রিয় ডোমেইনগুলোর SPF/DKIM/DMARC আবার দেখা। আগে verified ছিল কিন্তু এখন নয় →
// status "failed" (পাঠানো আপনাআপনি থামে — send গেট status দেখে), সুপার অ্যাডমিনকে নোটিফিকেশন।
// ফিরে verified হলে আবার চলে। প্রোভাইডার সাময়িক ব্যর্থ হলে স্ট্যাটাস বদলায় না (শুধু last_error)।
export async function runEmailDomainCheckTick(): Promise<void> {
  const supabase = getSupabase();
  const { data: domains, error } = await supabase
    .from("email_domains")
    .select("id, domain")
    .eq("is_active", true)
    .not("provider_domain_id", "is", null);

  if (error) {
    console.error("[email-domain-check] ডোমেইন তালিকা আনা ব্যর্থ:", error.message);
    return;
  }
  if (!domains || domains.length === 0) return;

  const provider = getEmailProvider();

  for (const row of domains) {
    try {
      const result = await refreshEmailDomain(supabase, provider, row.id, false);
      if (result.becameUnverified) {
        console.warn(`[email-domain-check] ডোমেইন আর verified নয়: ${row.domain}`);
        await notifySuperAdminsEmail(
          "email_domain_unverified",
          "ইমেইল ডোমেইন আর যাচাইকৃত নয়",
          `${row.domain} — DNS রেকর্ড বদলেছে বা মুছে গেছে। ঠিক না হওয়া পর্যন্ত কোনো ইমেইল যাবে না। ইমেইল অ্যাডমিন পেজ দেখুন।`
        );
      }
    } catch (err) {
      console.error(`[email-domain-check] ${row.domain} রিচেক ব্যর্থ:`, err instanceof Error ? err.message : err);
    }
  }
}
