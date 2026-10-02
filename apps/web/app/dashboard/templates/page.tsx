import Link from "next/link";
import { Plus, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, Pagination } from "@/components/ui";

const PAGE_SIZE = 20;

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: templates, count } = await supabase
    .from("templates")
    .select("id, name, category, content, media_type", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">টেমপ্লেট</h1>
        <Link
          href="/dashboard/templates/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> নতুন টেমপ্লেট
        </Link>
      </div>

      {(!templates || templates.length === 0) && (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="এখনো কোনো টেমপ্লেট নেই"
          description="ক্যাম্পেইনে ব্যবহারের জন্য প্রথম মেসেজ টেমপ্লেট বানান — {{name}} ভেরিয়েবল আর spintax দিয়ে প্রতিটা মেসেজে ভিন্নতা আনা যায়।"
          action={
            <Link
              href="/dashboard/templates/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> টেমপ্লেট বানান
            </Link>
          }
        />
      )}

      {templates && templates.length > 0 && (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>নাম</TableHeaderCell>
              <TableHeaderCell>মেসেজ</TableHeaderCell>
              <TableHeaderCell>মিডিয়া</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/dashboard/templates/${t.id}`} className="block font-medium text-text hover:text-primary hover:underline">
                    {t.name}
                  </Link>
                  {t.category && (
                    <Badge variant="info" className="mt-1">
                      {t.category}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate text-text-muted">{t.content}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.media_type === "image" && (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <ImageIcon className="h-4 w-4" /> ছবি
                    </span>
                  )}
                  {t.media_type === "document" && (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <FileIcon className="h-4 w-4" /> PDF
                    </span>
                  )}
                  {!t.media_type && <span className="text-text-muted">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination currentPage={page} totalPages={totalPages} hrefTemplate="/dashboard/templates?page={page}" />
    </div>
  );
}
