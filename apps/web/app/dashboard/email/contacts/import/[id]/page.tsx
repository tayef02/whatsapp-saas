import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, SkipForward, AlertTriangle, ShieldBan, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDhakaDateTime } from "@/lib/format-date";
import { EMAIL_SKIP_REASONS, emailSkipReasonLabel } from "@whatsapp-saas/core/email/skip-reasons";
import { Card, Pagination, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";
import AutoRefresh from "./AutoRefresh";

const SKIP_PAGE_SIZE = 50;

const statusLabel: Record<string, string> = { pending: "শুরু হচ্ছে...", processing: "প্রসেস হচ্ছে...", done: "শেষ হয়েছে", failed: "ব্যর্থ হয়েছে" };

// ইম্পোর্টের সারাংশ: কতজন যোগ হলো, কতজন বাদ ও কেন, কারণ-অনুযায়ী ফিল্টার করা স্কিপ তালিকা,
// আর সম্মতির রেকর্ড (কে, কখন, কোন বাক্যে)
export default async function EmailImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; reason?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, reason } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: imp } = await supabase
    .from("email_contact_imports")
    .select(
      "id, file_name, status, total_rows, processed_rows, added_count, duplicate_count, invalid_count, suppressed_count, error_message, applied_tag, consent_confirmed_at, consent_confirmed_by_email, consent_text, consent_text_version, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!imp) notFound();

  const running = imp.status === "pending" || imp.status === "processing";
  const activeReason = reason && EMAIL_SKIP_REASONS.includes(reason) ? reason : null;

  // কারণ-অনুযায়ী গণনা (head count, রো ফেরত আসে না) + বর্তমান ফিল্টারের পেজ
  let skipsQuery = supabase.from("email_contact_skips").select("row_no, email, reason", { count: "exact" }).eq("import_id", id);
  if (activeReason) skipsQuery = skipsQuery.eq("reason", activeReason);

  const [reasonCounts, { data: skips, count: skipCount }] = await Promise.all([
    Promise.all(
      EMAIL_SKIP_REASONS.map(async (r) => {
        const { count } = await supabase.from("email_contact_skips").select("id", { count: "exact", head: true }).eq("import_id", id).eq("reason", r);
        return { reason: r, count: count ?? 0 };
      })
    ),
    skipsQuery.order("row_no", { ascending: true }).range((page - 1) * SKIP_PAGE_SIZE, page * SKIP_PAGE_SIZE - 1),
  ]);

  const percent = imp.total_rows > 0 ? Math.round((imp.processed_rows / imp.total_rows) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil((skipCount ?? 0) / SKIP_PAGE_SIZE));
  const base = `/dashboard/email/contacts/import/${id}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {running && <AutoRefresh />}

      <Card>
        <h1 className="mb-1 text-base font-semibold text-text">ইমপোর্ট: {imp.file_name}</h1>
        <p className="mb-3 text-sm text-text-muted">
          {statusLabel[imp.status]}
          {imp.applied_tag ? ` · ট্যাগ: ${imp.applied_tag}` : ""}
        </p>

        {running && (
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
        <p className="mb-3 text-xs text-text-muted">
          {imp.processed_rows} / {imp.total_rows} সারি প্রসেস হয়েছে
        </p>

        {imp.status === "failed" && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{imp.error_message ?? "কিছু একটা ভুল হয়েছে"}</p>}

        {imp.status === "done" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-app-bg p-3 text-sm">
            <span className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" /> {imp.added_count} জন যোগ হয়েছে
            </span>
            <span className="flex items-center gap-2 text-text-muted">
              <SkipForward className="h-4 w-4" /> {imp.duplicate_count} জন ডুপ্লিকেট (বাদ গেছে)
            </span>
            <span className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" /> {imp.invalid_count} টা ইমেইল ইনভ্যালিড বা ফাঁকা (বাদ গেছে)
            </span>
            <span className="flex items-center gap-2 text-danger">
              <ShieldBan className="h-4 w-4" /> {imp.suppressed_count} জন ব্লক-তালিকায় আছে (আনসাবস্ক্রাইব/বাউন্স/স্প্যাম) — বাদ গেছে
            </span>
          </div>
        )}

        <Link href="/dashboard/email/contacts" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          কন্টাক্ট লিস্টে যান →
        </Link>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-muted" />
          <p className="text-sm font-semibold text-text">সম্মতির রেকর্ড</p>
        </div>
        <p className="text-sm text-text">&quot;{imp.consent_text}&quot;</p>
        <p className="mt-1 text-xs text-text-muted">
          নিশ্চিত করেছেন: {imp.consent_confirmed_by_email} · {formatDhakaDateTime(imp.consent_confirmed_at)} · বাক্য সংস্করণ {imp.consent_text_version}
        </p>
      </Card>

      {!running && reasonCounts.some((r) => r.count > 0) && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-text">কোন সারি কেন বাদ গেছে</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link
              href={base}
              className={`rounded-full border px-3 py-1 text-xs ${!activeReason ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted hover:bg-gray-50"}`}
            >
              সব
            </Link>
            {reasonCounts
              .filter((r) => r.count > 0)
              .map((r) => (
                <Link
                  key={r.reason}
                  href={`${base}?reason=${r.reason}`}
                  className={`rounded-full border px-3 py-1 text-xs ${activeReason === r.reason ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted hover:bg-gray-50"}`}
                >
                  {emailSkipReasonLabel(r.reason)} ({r.count})
                </Link>
              ))}
          </div>

          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>সারি</TableHeaderCell>
                <TableHeaderCell>ইমেইল</TableHeaderCell>
                <TableHeaderCell>কারণ</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(skips ?? []).map((s) => (
                <TableRow key={`${s.row_no}-${s.reason}`}>
                  <TableCell className="whitespace-nowrap text-text-muted">{s.row_no}</TableCell>
                  <TableCell className="break-all">{s.email ?? "—"}</TableCell>
                  <TableCell className="text-text-muted">{emailSkipReasonLabel(s.reason)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination currentPage={page} totalPages={totalPages} hrefTemplate={`${base}?page={page}${activeReason ? `&reason=${activeReason}` : ""}`} />
        </Card>
      )}
    </div>
  );
}
