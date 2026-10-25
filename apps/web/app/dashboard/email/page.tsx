import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { getEmailReadiness } from "@whatsapp-saas/core/email/readiness";
import SenderProfileForm from "./SenderProfileForm";
import TestEmailCard from "./TestEmailCard";

// ইমেইল চ্যানেলের ফেজ ১ — সেটআপ পেজ: চেকলিস্ট, প্রেরকের তথ্য, টেস্ট ইমেইল। (কন্টাক্ট, টেমপ্লেট,
// ক্যাম্পেইন পরের ফেজে।) সব কোয়েরি RLS-স্কোপড ক্লায়েন্টে — ব্রাউজারে যাওয়া নিরাপদ কলামই সিলেক্ট হয়
export default async function EmailSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase.from("workspace_members").select("workspace_id, role").limit(1).maybeSingle();
  if (!membership) return null;

  const canEdit = membership.role === "owner" || membership.role === "admin";

  const [{ data: domain }, { data: profile }, { count: suppressedCount }] = await Promise.all([
    supabase
      .from("email_domains")
      .select("domain, status, is_active, from_local")
      .is("workspace_id", null)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("email_sender_profiles")
      .select("from_name, from_name_status, requested_from_name, from_name_block_reason, reply_to_email, reply_to_verified_at, business_name, postal_address")
      .eq("workspace_id", membership.workspace_id)
      .maybeSingle(),
    supabase.from("email_suppressions").select("id", { count: "exact", head: true }).eq("workspace_id", membership.workspace_id),
  ]);

  const readiness = getEmailReadiness(domain, profile);
  const fromAddress = domain ? `${domain.from_local}@${domain.domain}` : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">ইমেইল সেটআপ</h1>
        <p className="text-sm text-text-muted">ইমেইল ক্যাম্পেইন পাঠানোর আগে এই ধাপগুলো সম্পন্ন করতে হবে।</p>
      </div>

      <Card>
        <p className="mb-3 text-sm font-semibold text-text">সেটআপ চেকলিস্ট</p>
        <ul className="flex flex-col gap-2">
          {readiness.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-text-muted" />}
              <span className={item.ok ? "text-text" : "text-text-muted"}>{item.label}</span>
            </li>
          ))}
        </ul>
        {fromAddress && (
          <p className="mt-3 text-xs text-text-muted">
            পাঠানোর ঠিকানা: <span className="font-medium text-text">{fromAddress}</span> (সব ওয়ার্কস্পেস একই ডোমেইন থেকে পাঠায়, শুধু From নাম আলাদা)
          </p>
        )}
        {!domain && <p className="mt-3 text-xs text-warning">প্ল্যাটফর্ম ডোমেইন এখনো সেট করা হয়নি — সুপার অ্যাডমিনকে জানান।</p>}
      </Card>

      <SenderProfileForm
        fromNameValue={profile?.requested_from_name ?? profile?.from_name ?? ""}
        fromNameStatus={profile?.from_name_status ?? "none"}
        blockReason={profile?.from_name_block_reason ?? null}
        replyTo={profile?.reply_to_email ?? ""}
        replyToVerified={Boolean(profile?.reply_to_verified_at)}
        businessName={profile?.business_name ?? ""}
        postalAddress={profile?.postal_address ?? ""}
        canEdit={canEdit}
      />

      <TestEmailCard ready={readiness.ready} canEdit={canEdit} accountEmail={user?.email ?? ""} />

      <Card>
        <p className="text-sm font-semibold text-text">আনসাবস্ক্রাইব ও ব্লক তালিকা</p>
        <p className="mt-1 text-sm text-text-muted">
          {suppressedCount ?? 0} জনকে আর ইমেইল পাঠানো হবে না (আনসাবস্ক্রাইব, বাউন্স, স্প্যাম রিপোর্ট)। এই তালিকা থেকে কাউকে ফেরত আনা যায় না।
        </p>
      </Card>
    </div>
  );
}
