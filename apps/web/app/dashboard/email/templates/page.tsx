import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDhakaDateTime } from "@/lib/format-date";
import { Badge, EmptyState, Pagination, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";

const PAGE_SIZE = 20;

export default async function EmailTemplatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: templates, count } = await supabase
    .from("email_templates")
    .select("id, name, category, subject, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const newLink = (
    <Link
      href="/dashboard/email/templates/new"
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
    >
      <Plus className="h-4 w-4" /> নতুন টেমপ্লেট
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">ইমেইল টেমপ্লেট</h1>
        {newLink}
      </div>

      {(!templates || templates.length === 0) && (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="এখনো কোনো ইমেইল টেমপ্লেট নেই"
          description="সাবজেক্ট, HTML আর plain text দিয়ে টেমপ্লেট বানান — {{name}} ভেরিয়েবল চলবে। ফুটার ও আনসাবস্ক্রাইব লিংক প্রতিটা ইমেইলে নিজে থেকে যোগ হবে।"
          action={newLink}
        />
      )}

      {templates && templates.length > 0 && (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>নাম</TableHeaderCell>
              <TableHeaderCell>সাবজেক্ট</TableHeaderCell>
              <TableHeaderCell>সর্বশেষ বদল</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/dashboard/email/templates/${t.id}`} className="block font-medium text-text hover:text-primary hover:underline">
                    {t.name}
                  </Link>
                  {t.category && (
                    <Badge variant="info" className="mt-1">
                      {t.category}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate text-text-muted">{t.subject}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDateTime(t.updated_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination currentPage={page} totalPages={totalPages} hrefTemplate="/dashboard/email/templates?page={page}" />
    </div>
  );
}
