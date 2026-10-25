import { resolveTxt } from "node:dns/promises";
import { EmailProviderError, type EmailProvider } from "../providers/email-types";

// supabase client এর পুরো টাইপ দরকার নেই (web আর worker দুই জায়গার client এখানে চলবে)
interface SupabaseLike {
  from(table: string): any;
}

export type DmarcResult = { status: "missing" | "present" | "invalid"; policy: "none" | "quarantine" | "reject" | null };

// DMARC লুকআপ: আগে ঠিক ওই (সাব)ডোমেইনের _dmarc, না পেলে উপরের ডোমেইনগুলোর (DMARC উত্তরাধিকার —
// mail.example.com এ না থাকলে example.com এর রেকর্ড প্রযোজ্য)। Resend DMARC যাচাই করে কিনা
// ডকুমেন্টেশনে স্পষ্ট নেই, তাই এটা আমরা নিজে DNS থেকে দেখি।
export async function lookupDmarc(domain: string): Promise<DmarcResult> {
  const labels = domain.split(".");
  // কমপক্ষে ২টা লেবেল (example.com) পর্যন্ত উপরে ওঠা
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".");
    let records: string[][];
    try {
      records = await resolveTxt(`_dmarc.${candidate}`);
    } catch {
      continue; // ENOTFOUND / ENODATA — উপরের ডোমেইন চেষ্টা
    }

    const record = records.map((chunks) => chunks.join("")).find((r) => /^\s*v=DMARC1\b/i.test(r));
    if (!record) continue;

    const policyMatch = record.match(/(?:^|;)\s*p\s*=\s*(none|quarantine|reject)\s*(?:;|$)/i);
    if (!policyMatch) return { status: "invalid", policy: null };
    return { status: "present", policy: policyMatch[1].toLowerCase() as "none" | "quarantine" | "reject" };
  }
  return { status: "missing", policy: null };
}

export interface DomainRefreshResult {
  previousStatus: string;
  currentStatus: string;
  becameVerified: boolean;
  becameUnverified: boolean;
  errorCode: string | null;
}

// ডোমেইনের আসল অবস্থা প্রোভাইডার ও DNS থেকে এনে email_domains আপডেট করে।
//   triggerVerify=true  — অ্যাডমিনের "যাচাই করুন" বোতাম: প্রথমে প্রোভাইডারকে DNS আবার দেখতে বলে
//   triggerVerify=false — দৈনিক রিচেক: শুধু বর্তমান অবস্থা পড়ে
// status নিয়ম: SPF + DKIM verified এবং DMARC present হলে "verified"। আগে verified ছিল কিন্তু এখন নয়
// → "failed" (পাঠানো থেমে যায়, অ্যাডমিনকে জানানো হয়)। "suspended" হাতে বসানো — এখানে বদলায় না।
export async function refreshEmailDomain(
  supabase: SupabaseLike,
  provider: EmailProvider,
  domainId: string,
  triggerVerify: boolean
): Promise<DomainRefreshResult> {
  const { data: row, error: readError } = await supabase
    .from("email_domains")
    .select("id, domain, provider_domain_id, status, verified_at")
    .eq("id", domainId)
    .maybeSingle();

  if (readError || !row) throw new Error("ডোমেইন রো পাওয়া যায়নি");
  if (!row.provider_domain_id) throw new Error("ডোমেইনের provider id নেই");

  const previousStatus: string = row.status;
  const nowIso = new Date().toISOString();

  let providerDomain;
  try {
    // verified ডোমেইনে verify কল করা হয় না: প্রোভাইডার তখন স্ট্যাটাস সাময়িকভাবে "pending" করে দেয়,
    // আর সাথে সাথে পড়লে ভুলে "failed" ধরা পড়ত
    if (triggerVerify && previousStatus !== "verified") await provider.verifyDomain(row.provider_domain_id);
    providerDomain = await provider.getDomain(row.provider_domain_id);
  } catch (err) {
    // প্রোভাইডার ব্যর্থ — স্ট্যাটাস বদলাই না (সাময়িক সমস্যায় verified ডোমেইন failed হয়ে যাওয়া উচিত না)
    const code = err instanceof EmailProviderError ? err.kind : "unknown";
    await supabase.from("email_domains").update({ last_checked_at: nowIso, last_error: `provider_${code}`, updated_at: nowIso }).eq("id", domainId);
    return { previousStatus, currentStatus: previousStatus, becameVerified: false, becameUnverified: false, errorCode: `provider_${code}` };
  }

  let dmarc: DmarcResult;
  try {
    dmarc = await lookupDmarc(row.domain);
  } catch {
    dmarc = { status: "missing", policy: null };
  }

  const allOk = providerDomain.spf === "verified" && providerDomain.dkim === "verified" && dmarc.status === "present";
  const anyFailed = providerDomain.spf === "failed" || providerDomain.dkim === "failed";

  let currentStatus: string;
  if (previousStatus === "suspended") currentStatus = "suspended";
  else if (allOk) currentStatus = "verified";
  else if (anyFailed || previousStatus === "verified") currentStatus = "failed";
  else currentStatus = "pending";

  const update: Record<string, unknown> = {
    status: currentStatus,
    spf_status: providerDomain.spf,
    dkim_status: providerDomain.dkim,
    dmarc_status: dmarc.status,
    dmarc_policy: dmarc.policy,
    dns_records: providerDomain.records,
    last_checked_at: nowIso,
    last_error: null,
    updated_at: nowIso,
  };
  // verified_at শুধু প্রথমবার — warm-up এর হিসাব পরে আবার verified হলেও রিসেট হয় না
  if (currentStatus === "verified" && !row.verified_at) update.verified_at = nowIso;

  const { error: updateError } = await supabase.from("email_domains").update(update).eq("id", domainId);
  if (updateError) throw new Error(`ডোমেইন আপডেট ব্যর্থ: ${updateError.message}`);

  return {
    previousStatus,
    currentStatus,
    becameVerified: previousStatus !== "verified" && currentStatus === "verified",
    becameUnverified: previousStatus === "verified" && currentStatus !== "verified",
    errorCode: null,
  };
}
