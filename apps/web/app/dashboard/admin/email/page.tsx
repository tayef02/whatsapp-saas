import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDhakaDateTime } from "@/lib/format-date";
import DomainManager, { type DomainView } from "./DomainManager";
import PendingFromNames, { type PendingName } from "./PendingFromNames";

// সুপার অ্যাডমিনের ইমেইল পেজ: প্ল্যাটফর্ম ডোমেইন যাচাই + ব্লক-তালিকায় পড়া From নামের অনুমোদন
export default async function AdminEmailPage() {
  if (process.env.NEXT_PUBLIC_EMAIL_ENABLED !== "true") notFound();

  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (!isSuperAdmin) notFound();

  // সব workspace এর অনুরোধ দেখতে হয় → service_role (payments অ্যাডমিন পেজের একই কারণ)
  const admin = createAdminClient();
  const [{ data: domainRow }, { data: pendingRows }] = await Promise.all([
    admin
      .from("email_domains")
      .select("id, domain, status, spf_status, dkim_status, dmarc_status, dmarc_policy, dns_records, verified_at, last_checked_at, last_error")
      .is("workspace_id", null)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("email_sender_profiles")
      .select("workspace_id, requested_from_name, from_name_block_reason, updated_at, workspaces(name)")
      .eq("from_name_status", "pending_approval")
      .order("updated_at", { ascending: true }),
  ]);

  const domain: DomainView | null = domainRow
    ? {
        id: domainRow.id,
        domain: domainRow.domain,
        status: domainRow.status,
        spf_status: domainRow.spf_status,
        dkim_status: domainRow.dkim_status,
        dmarc_status: domainRow.dmarc_status,
        dmarc_policy: domainRow.dmarc_policy,
        dns_records: domainRow.dns_records ?? [],
        verified_at: domainRow.verified_at ? formatDhakaDateTime(domainRow.verified_at) : null,
        last_checked_at: domainRow.last_checked_at ? formatDhakaDateTime(domainRow.last_checked_at) : null,
        last_error: domainRow.last_error,
      }
    : null;

  const pending: PendingName[] = (pendingRows ?? []).map((row) => ({
    workspaceId: row.workspace_id,
    workspaceName: (row.workspaces as unknown as { name: string } | null)?.name ?? "—",
    requestedName: row.requested_from_name ?? "",
    blockReason: row.from_name_block_reason,
    requestedAt: formatDhakaDateTime(row.updated_at),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">ইমেইল অ্যাডমিন</h1>
        <p className="text-sm text-text-muted">প্ল্যাটফর্ম ডোমেইন যাচাই ও From নামের অনুমোদন।</p>
      </div>
      <DomainManager domain={domain} dmarcName={domain ? `_dmarc.${domain.domain}` : null} />
      <PendingFromNames items={pending} />
    </div>
  );
}
