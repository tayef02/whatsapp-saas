"use client";

import Link from "next/link";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, EmptyState } from "@/components/ui";
import { History } from "lucide-react";
import { formatDhakaDateTime } from "@/lib/format-date";
import { SKIP_REASON_LABEL } from "./skip-reasons";

type CommentRow = {
  id: string;
  from_name: string | null;
  comment_text: string;
  reply_sent: boolean;
  reply_text: string | null;
  is_lead: boolean;
  lead_phone: string | null;
  created_at: string;
  skip: { reason: string; status: string } | null;
};

export default function CommentLogTable({ comments }: { comments: CommentRow[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-text">সাম্প্রতিক কমেন্ট (সর্বশেষ ৫০টা)</p>
      {comments.length === 0 ? (
        <EmptyState icon={<History className="h-10 w-10" />} title="এখনো কোনো কমেন্ট আসেনি" />
      ) : (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>কাস্টমার</TableHeaderCell>
              <TableHeaderCell>কমেন্ট</TableHeaderCell>
              <TableHeaderCell>রিপ্লাই</TableHeaderCell>
              <TableHeaderCell>স্কিপ কারণ</TableHeaderCell>
              <TableHeaderCell>তারিখ</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap">
                  {c.from_name || "(অজানা)"}
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
                  {c.reply_sent ? (
                    <Badge variant="success">পাঠানো হয়েছে</Badge>
                  ) : (
                    <Badge variant="neutral">রিপ্লাই যায়নি</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.skip ? (
                    <Link href="/dashboard/messenger/comments/skipped" className="text-xs text-primary hover:underline">
                      {SKIP_REASON_LABEL[c.skip.reason] ?? c.skip.reason}
                    </Link>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">{formatDhakaDateTime(c.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
