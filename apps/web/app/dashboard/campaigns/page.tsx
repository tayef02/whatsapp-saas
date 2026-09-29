import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge } from "@/components/ui";

const statusLabel: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "শিডিউল হয়েছে",
  sending: "পাঠানো হচ্ছে",
  paused: "পজ করা",
  cancelled: "বাতিল",
  completed: "শেষ হয়েছে",
  failed: "ব্যর্থ",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  sending: "success",
  scheduled: "info",
  paused: "warning",
  cancelled: "neutral",
  completed: "info",
  failed: "danger",
  draft: "neutral",
};

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, campaign_stats(total_recipients, sent_count, delivered_count, read_count, failed_count)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">ক্যাম্পেইন</h1>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> নতুন ক্যাম্পেইন
        </Link>
      </div>

      {(!campaigns || campaigns.length === 0) && (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="এখনো কোনো ক্যাম্পেইন নেই"
          description="একটা টেমপ্লেট আর অনলাইন নাম্বার থাকলেই প্রথম ক্যাম্পেইন পাঠাতে পারবেন।"
          action={
            <Link
              href="/dashboard/campaigns/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> নতুন ক্যাম্পেইন
            </Link>
          }
        />
      )}

      {campaigns && campaigns.length > 0 && (
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>নাম</TableHeaderCell>
              <TableHeaderCell>অগ্রগতি</TableHeaderCell>
              <TableHeaderCell>স্ট্যাটাস</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => {
              const stats = Array.isArray(c.campaign_stats) ? c.campaign_stats[0] : c.campaign_stats;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-text hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {stats
                      ? `${stats.sent_count}/${stats.total_recipients} পাঠানো · ${Math.max(stats.delivered_count, stats.read_count)} ডেলিভার্ড · ${stats.read_count} পড়া · ${stats.failed_count} ব্যর্থ`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? "neutral"}>{statusLabel[c.status] ?? c.status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
