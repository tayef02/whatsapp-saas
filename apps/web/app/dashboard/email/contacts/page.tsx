import Link from "next/link";
import { Plus, Search, Upload, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDhakaDate, formatDhakaDateTime } from "@/lib/format-date";
import { Badge, EmptyState, Pagination, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";

const PAGE_SIZE = 50;

// PostgREST এর or() ফিল্টারে কমা/ব্র্যাকেটের বিশেষ অর্থ আছে — সার্চ থেকে সরিয়ে দেওয়া হয়
function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

const importStatusLabel: Record<string, string> = { pending: "শুরু হচ্ছে", processing: "প্রসেস হচ্ছে", done: "শেষ", failed: "ব্যর্থ" };
const importStatusVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  pending: "neutral",
  processing: "warning",
  done: "success",
  failed: "danger",
};

export default async function EmailContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>;
}) {
  const { page: pageParam, q, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase.from("email_contacts").select("id, email, name, tags, consent_source, created_at", { count: "exact" });
  if (q) {
    const safe = sanitizeSearch(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  if (tag) query = query.contains("tags", [tag]);

  const [{ data: contacts, count }, { data: imports }] = await Promise.all([
    query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase
      .from("email_contact_imports")
      .select("id, file_name, status, added_count, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(q || tag);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">ইমেইল কন্টাক্ট ({count ?? 0})</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/email/contacts/import"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" /> ইমপোর্ট
          </Link>
          <Link
            href="/dashboard/email/contacts/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> নতুন কন্টাক্ট
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="নাম বা ইমেইল দিয়ে খুঁজুন"
            className="w-full rounded-lg border border-border py-2 pr-3 pl-9 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          name="tag"
          defaultValue={tag ?? ""}
          placeholder="ট্যাগ দিয়ে ফিল্টার"
          className="w-40 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button type="submit" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50">
          খুঁজুন
        </button>
      </form>

      {(!contacts || contacts.length === 0) && !hasFilters && (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="এখনো কোনো ইমেইল কন্টাক্ট নেই"
          description="যারা আপনার কাছ থেকে ইমেইল পেতে সম্মতি দিয়েছেন শুধু তাদেরই যোগ করুন — ম্যানুয়ালি অথবা CSV/Excel ফাইল থেকে।"
        />
      )}
      {(!contacts || contacts.length === 0) && hasFilters && (
        <EmptyState icon={<Search className="h-10 w-10" />} title="কোনো কন্টাক্ট পাওয়া যায়নি" description="সার্চ/ফিল্টার বদলে আবার চেষ্টা করুন।" />
      )}

      {contacts && contacts.length > 0 && (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>ইমেইল</TableHeaderCell>
              <TableHeaderCell>নাম</TableHeaderCell>
              <TableHeaderCell>ট্যাগ</TableHeaderCell>
              <TableHeaderCell>সম্মতির উৎস</TableHeaderCell>
              <TableHeaderCell>যোগ হয়েছে</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/dashboard/email/contacts/${c.id}`} className="font-medium text-text hover:text-primary hover:underline">
                    {c.email}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">{c.name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.tags as string[]).map((t) => (
                      <Badge key={t} variant="info">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{c.consent_source === "import_confirmed" ? "ইম্পোর্টে নিশ্চিত" : "ম্যানুয়াল"}</TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDate(c.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        hrefTemplate={`/dashboard/email/contacts?page={page}${q ? `&q=${encodeURIComponent(q)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
      />

      {imports && imports.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-text">সাম্প্রতিক ইম্পোর্ট</p>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {imports.map((imp) => (
              <li key={imp.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/dashboard/email/contacts/import/${imp.id}`} className="font-medium text-text hover:text-primary hover:underline">
                  {imp.file_name}
                </Link>
                <span className="flex items-center gap-3 text-text-muted">
                  {imp.added_count} জন যোগ · {formatDhakaDateTime(imp.created_at)}
                  <Badge variant={importStatusVariant[imp.status] ?? "neutral"}>{importStatusLabel[imp.status] ?? imp.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
