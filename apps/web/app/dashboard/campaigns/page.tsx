import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusLabel: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "শিডিউল হয়েছে",
  sending: "পাঠানো হচ্ছে",
  paused: "পজ করা",
  cancelled: "বাতিল",
  completed: "শেষ হয়েছে",
  failed: "ব্যর্থ",
};

const statusColor: Record<string, string> = {
  sending: "#dcfce7",
  paused: "#fef3c7",
  cancelled: "#f3f4f6",
  completed: "#dbeafe",
  failed: "#fee2e2",
};

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, campaign_stats(total_recipients, sent_count, delivered_count, read_count, failed_count)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>ক্যাম্পেইন</h1>
        <Link
          href="/dashboard/campaigns/new"
          style={{ background: "#16a34a", color: "white", padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}
        >
          + নতুন ক্যাম্পেইন
        </Link>
      </div>

      {(!campaigns || campaigns.length === 0) && <p>এখনো কোনো ক্যাম্পেইন নেই।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campaigns?.map((c) => {
          const stats = Array.isArray(c.campaign_stats) ? c.campaign_stats[0] : c.campaign_stats;
          return (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 14,
                background: "white",
                borderRadius: 8,
                border: "1px solid #eee",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <strong>{c.name}</strong>
                <div style={{ fontSize: 13, color: "#666" }}>
                  {stats
                    ? `${stats.sent_count}/${stats.total_recipients} পাঠানো হয়েছে · ${stats.delivered_count} ডেলিভার্ড · ${stats.read_count} পড়া হয়েছে · ${stats.failed_count} ব্যর্থ`
                    : ""}
                </div>
              </div>
              <span
                style={{
                  alignSelf: "center",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: statusColor[c.status] ?? "#f3f4f6",
                }}
              >
                {statusLabel[c.status] ?? c.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
