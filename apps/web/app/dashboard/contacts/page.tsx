import Link from "next/link";
import { Plus, Search, Users, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pagination } from "@/components/ui";
import ContactsTable from "./ContactsTable";
import ImportButton from "./ImportButton";

const PAGE_SIZE = 50;

// PostgREST এর or() ফিল্টার সিনট্যাক্সে কমা/ব্র্যাকেট বিশেষ অর্থ বহন করে,
// সার্চ ইনপুটে থাকলে ফিল্টার ভেঙে যেতে পারে — তাই সরিয়ে দেওয়া হচ্ছে
function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>;
}) {
  const { page: pageParam, q, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase.from("contacts").select("id, phone, name, tags, opted_out, created_at", { count: "exact" });

  if (q) {
    const safe = sanitizeSearch(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: contacts, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(q || tag);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">কন্টাক্ট ({count ?? 0})</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/contacts/export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> CSV এক্সপোর্ট
          </a>
          <ImportButton />
          <Link
            href="/dashboard/contacts/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> নতুন কন্টাক্ট
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="নাম বা নাম্বার দিয়ে খুঁজুন"
            className="w-full rounded-lg border border-border py-2 pr-3 pl-9 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          name="tag"
          defaultValue={tag ?? ""}
          placeholder="ট্যাগ দিয়ে ফিল্টার"
          className="w-40 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50"
        >
          খুঁজুন
        </button>
      </form>

      {(!contacts || contacts.length === 0) && !hasFilters && (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="এখনো কোনো কন্টাক্ট নেই"
          description="ম্যানুয়ালি একজন যোগ করুন অথবা CSV/Excel ফাইল থেকে ইমপোর্ট করুন।"
          action={
            <div className="flex justify-center gap-2">
              <ImportButton />
              <Link
                href="/dashboard/contacts/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4" /> নতুন কন্টাক্ট
              </Link>
            </div>
          }
        />
      )}

      {(!contacts || contacts.length === 0) && hasFilters && (
        <EmptyState icon={<Search className="h-10 w-10" />} title="কোনো কন্টাক্ট পাওয়া যায়নি" description="সার্চ/ফিল্টার বদলে আবার চেষ্টা করুন।" />
      )}

      {contacts && contacts.length > 0 && <ContactsTable contacts={contacts} />}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        hrefTemplate={`/dashboard/contacts?page={page}${q ? `&q=${encodeURIComponent(q)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
      />
    </div>
  );
}
