"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Flag, Users } from "lucide-react";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, Button, EmptyState, useToast } from "@/components/ui";
import { unflagMember } from "../../actions";
import { formatDhakaDateTime } from "@/lib/format-date";

type Member = {
  id: string;
  phone: string;
  name: string | null;
  is_group_admin: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  last_activity_at: string | null;
};

export default function MembersList({ members }: { members: Member[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleUnflag(memberId: string) {
    setBusyId(memberId);
    const res = await unflagMember(memberId);
    setBusyId(null);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "flag সরানো হয়েছে");
    router.refresh();
  }

  if (members.length === 0) {
    return <EmptyState icon={<Users className="h-10 w-10" />} title="কোনো মেম্বার নেই" description="সারাংশ ট্যাব থেকে গ্রুপ লিস্ট পেজে গিয়ে সিঙ্ক করা লাগতে পারে।" />;
  }

  return (
    <Table>
      <TableHead>
        <TableRow className="hover:bg-transparent">
          <TableHeaderCell>নাম/নাম্বার</TableHeaderCell>
          <TableHeaderCell>রোল</TableHeaderCell>
          <TableHeaderCell>শেষ সক্রিয়</TableHeaderCell>
          <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium text-text">{m.name || m.phone}</TableCell>
            <TableCell>
              {m.is_group_admin && (
                <Badge variant="info">
                  <Crown className="h-3 w-3" /> অ্যাডমিন
                </Badge>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap text-text-muted">
              {m.last_activity_at ? formatDhakaDateTime(m.last_activity_at) : "—"}
            </TableCell>
            <TableCell>
              {m.is_flagged ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">
                    <Flag className="h-3 w-3" /> {m.flag_reason || "flagged"}
                  </Badge>
                  <Button variant="ghost" disabled={busyId === m.id} onClick={() => handleUnflag(m.id)} className="px-2 py-1 text-xs">
                    flag সরান
                  </Button>
                </div>
              ) : (
                <Badge variant="success">স্বাভাবিক</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
