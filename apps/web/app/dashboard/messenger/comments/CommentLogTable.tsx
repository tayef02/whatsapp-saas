"use client";

import Link from "next/link";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, EmptyState, Pagination } from "@/components/ui";
import { History } from "lucide-react";
import { formatDhakaDateTime } from "@/lib/format-date";
import { SKIP_REASON_LABEL } from "./skip-reasons";

type CommentRow = {
  id: string;
  from_name: string | null;
  comment_text: string;
  reply_text: string | null;
  is_lead: boolean;
  lead_phone: string | null;
  is_own_comment: boolean;
  action: "public_reply" | "private_reply" | null;
  replied_at: string | null;
  queued_at: string | null;
  reply_scheduled_at: string | null;
  created_at: string;
  skip: { reason: string; status: string } | null;
};

function ReplyStatus({ c }: { c: CommentRow }) {
  if (c.is_own_comment) {
    return <Badge variant="neutral">পেজের নিজের কমেন্ট</Badge>;
  }

  if (c.replied_at) {
    return <Badge variant="success">{c.action === "private_reply" ? "প্রাইভেট রিপ্লাই গেছে" : "পাবলিক রিপ্লাই গেছে"}</Badge>;
  }

  if (c.skip) {
    return (
      <Link href="/dashboard/messenger/comments/skipped">
        <Badge variant="danger">স্কিপ: {SKIP_REASON_LABEL[c.skip.reason] ?? c.skip.reason}</Badge>
      </Link>
    );
  }

  if (c.action && c.queued_at) {
    const remainingMs = c.reply_scheduled_at ? new Date(c.reply_scheduled_at).getTime() - Date.now() : 0;
    const remainingMin = Math.ceil(remainingMs / 60000);
    return (
      <Badge variant="info">
        কিউয়ে আছে{remainingMin > 0 ? ` (${remainingMin} মিনিট পরে)` : ""}
      </Badge>
    );
  }

  return <Badge variant="neutral">—</Badge>;
}

export default function CommentLogTable({
  comments,
  selectedPageId,
  logPage,
  totalPages,
}: {
  comments: CommentRow[];
  selectedPageId: string;
  logPage: number;
  totalPages: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-text">কমেন্ট লগ</p>
      {comments.length === 0 ? (
        <EmptyState icon={<History className="h-10 w-10" />} title="এখনো কোনো কমেন্ট আসেনি" />
      ) : (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>কাস্টমার</TableHeaderCell>
              <TableHeaderCell>কমেন্ট</TableHeaderCell>
              <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
              <TableHeaderCell>তারিখ</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap">
                  {c.is_own_comment ? <span className="text-text-muted">(পেজ)</span> : c.from_name || "(অজানা)"}
                  {c.is_lead && (
                    <Badge variant="success" className="ml-1.5">
                      লিড {c.lead_phone}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[280px] truncate" title={c.comment_text}>
                  {c.comment_text || <span className="text-text-muted">(টেক্সট নেই)</span>}
                </TableCell>
                <TableCell>
                  <ReplyStatus c={c} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDateTime(c.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination
        currentPage={logPage}
        totalPages={totalPages}
        hrefTemplate={`/dashboard/messenger/comments?page=${selectedPageId}&logPage={page}`}
      />
    </div>
  );
}
