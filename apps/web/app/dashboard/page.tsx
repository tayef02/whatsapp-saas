import Link from "next/link";
import {
  Smartphone,
  Users,
  Send,
  Megaphone,
  Plus,
  Upload,
  ArrowRight,
  MessageCircleWarning,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDhakaDateTime, getDhakaDayBoundariesUtc } from "@/lib/format-date";

const campaignStatusLabel: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "শিডিউল হয়েছে",
  sending: "পাঠানো হচ্ছে",
  paused: "পজ করা",
  cancelled: "বাতিল",
  completed: "শেষ হয়েছে",
  failed: "ব্যর্থ",
};

const campaignStatusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  sending: "success",
  scheduled: "info",
  paused: "warning",
  cancelled: "neutral",
  completed: "info",
  failed: "danger",
  draft: "neutral",
};

type DayCount = { label: string; sent: number; delivered: number; failed: number };

const CHART_SERIES = [
  { key: "sent" as const, color: "var(--color-info)", label: "পাঠানো" },
  { key: "delivered" as const, color: "var(--color-success)", label: "ডেলিভার্ড" },
  { key: "failed" as const, color: "var(--color-danger)", label: "ব্যর্থ" },
];

export default async function DashboardHome() {
  const supabase = await createClient();

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select(
      "workspace_id, workspaces(daily_message_limit, messages_used_this_cycle, plans(name, monthly_message_limit))"
    )
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as {
    daily_message_limit: number;
    messages_used_this_cycle: number;
    plans: { name: string; monthly_message_limit: number } | null;
  } | null;

  const { count: totalNumbersCount } = await supabase
    .from("whatsapp_numbers")
    .select("id", { count: "exact", head: true });
  const { count: onlineNumbersCount } = await supabase
    .from("whatsapp_numbers")
    .select("id", { count: "exact", head: true })
    .eq("status", "online");

  const { count: contactsCount } = await supabase.from("contacts").select("id", { count: "exact", head: true });

  const { count: activeCampaignsCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "sending"]);

  const { data: lastCampaign } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentConversations } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, contacts(name, phone)")
    .order("last_message_at", { ascending: false })
    .limit(3);

  const { count: pendingOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // আজকের পাঠানো মেসেজ — Dhaka দিনের সীমানা, worker এর SQL ফাংশনের সাথে একই কনভেনশন
  const { startIso: todayStart } = getDhakaDayBoundariesUtc(0);
  const { count: todaySentCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", todayStart)
    .in("status", ["sent", "delivered", "read"]);

  // গত ৭ দিনের চার্ট — একবারে সব রো এনে দিনভিত্তিক bucket করা হচ্ছে (আলাদা ২১টা কোয়েরির বদলে)
  const { startIso: weekStart } = getDhakaDayBoundariesUtc(6);
  const { data: weekMessages } = await supabase
    .from("messages")
    .select("status, created_at")
    .gte("created_at", weekStart)
    .order("created_at", { ascending: true });

  const chartData: DayCount[] = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    const { startIso, endIso } = getDhakaDayBoundariesUtc(daysAgo);
    const dayMessages = (weekMessages ?? []).filter((m) => m.created_at >= startIso && m.created_at < endIso);
    return {
      label: new Date(startIso).toLocaleDateString("bn-BD", { weekday: "short", timeZone: "Asia/Dhaka" }),
      sent: dayMessages.filter((m) => ["sent", "delivered", "read"].includes(m.status)).length,
      delivered: dayMessages.filter((m) => ["delivered", "read"].includes(m.status)).length,
      failed: dayMessages.filter((m) => m.status === "failed").length,
    };
  });

  const dailyLimit = workspace?.daily_message_limit ?? 0;
  const monthlyLimit = workspace?.plans?.monthly_message_limit ?? 0;
  const usedThisCycle = workspace?.messages_used_this_cycle ?? 0;
  const monthlyUsagePct = monthlyLimit > 0 ? Math.min(100, Math.round((usedThisCycle / monthlyLimit) * 100)) : 0;

  const hasNoNumbers = (totalNumbersCount ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6">
      {hasNoNumbers && (
        <EmptyState
          icon={<Smartphone className="h-10 w-10" />}
          title="প্রথম WhatsApp নাম্বার কানেক্ট করুন"
          description="নাম্বার কানেক্ট করলেই কন্টাক্ট যোগ, টেমপ্লেট বানানো আর ক্যাম্পেইন পাঠানো শুরু করতে পারবেন।"
          action={
            <Link
              href="/dashboard/numbers/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> নাম্বার কানেক্ট করুন
            </Link>
          }
        />
      )}

      {/* স্ট্যাট কার্ড */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Smartphone className="h-5 w-5" />}
          label="কানেক্টেড নাম্বার"
          value={`${onlineNumbersCount ?? 0}`}
          sub={`মোট ${totalNumbersCount ?? 0}টি নাম্বার`}
        />
        <StatCard icon={<Users className="h-5 w-5" />} label="মোট কন্টাক্ট" value={`${contactsCount ?? 0}`} />
        <StatCard
          icon={<Send className="h-5 w-5" />}
          label="আজকের পাঠানো মেসেজ"
          value={`${todaySentCount ?? 0}`}
          sub={dailyLimit > 0 ? `দৈনিক লিমিট ${dailyLimit}` : undefined}
        />
        <StatCard
          icon={<Megaphone className="h-5 w-5" />}
          label="চলমান ক্যাম্পেইন"
          value={`${activeCampaignsCount ?? 0}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* গত ৭ দিনের মেসেজ চার্ট */}
        <Card className="lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-text">গত ৭ দিনের মেসেজ</p>
          <WeeklyMessageChart data={chartData} />
        </Card>

        {/* প্ল্যান ব্যবহার */}
        <Card>
          <p className="mb-3 text-sm font-semibold text-text">প্ল্যান ব্যবহার</p>
          {workspace?.plans ? (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
                <span>{workspace.plans.name}</span>
                <span>
                  {usedThisCycle} / {monthlyLimit} মেসেজ
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${monthlyUsagePct >= 90 ? "bg-danger" : monthlyUsagePct >= 70 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${monthlyUsagePct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-text-muted">{monthlyUsagePct}% ব্যবহার হয়েছে এই সাইকেলে</p>
              <Link href="/dashboard/billing" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                প্ল্যান দেখুন <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-text-muted">কোনো active প্ল্যান নেই।</p>
          )}
        </Card>
      </div>

      {/* দ্রুত কাজ */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-text">দ্রুত কাজ</p>
        <div className="flex flex-wrap gap-3">
          <QuickAction href="/dashboard/campaigns/new" icon={<Megaphone className="h-4 w-4" />} label="নতুন ক্যাম্পেইন" />
          <QuickAction href="/dashboard/contacts/import" icon={<Upload className="h-4 w-4" />} label="কন্টাক্ট ইমপোর্ট" />
          <QuickAction href="/dashboard/numbers/new" icon={<Smartphone className="h-4 w-4" />} label="নাম্বার কানেক্ট" />
        </div>
      </Card>

      {/* সাম্প্রতিক কার্যক্রম */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-text">সাম্প্রতিক কার্যক্রম</p>
        <div className="flex flex-col divide-y divide-border">
          {lastCampaign && (
            <Link href={`/dashboard/campaigns/${lastCampaign.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="flex items-center gap-2.5 text-sm text-text">
                <Megaphone className="h-4 w-4 shrink-0 text-text-muted" />
                <span>
                  সর্বশেষ ক্যাম্পেইন: <strong className="font-medium">{lastCampaign.name}</strong>
                </span>
              </div>
              <Badge variant={campaignStatusVariant[lastCampaign.status] ?? "neutral"}>
                {campaignStatusLabel[lastCampaign.status] ?? lastCampaign.status}
              </Badge>
            </Link>
          )}

          {(recentConversations ?? []).map((c) => {
            const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
            return (
              <Link key={c.id} href={`/dashboard/inbox/${c.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex items-center gap-2.5 text-sm text-text">
                  {c.status === "handed_off" ? (
                    <MessageCircleWarning className="h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <Users className="h-4 w-4 shrink-0 text-text-muted" />
                  )}
                  <span>
                    {c.status === "handed_off" ? "এজেন্ট দরকার: " : "ইনবক্স: "}
                    <strong className="font-medium">{contact?.name || contact?.phone || "(অজানা)"}</strong>
                  </span>
                </div>
                <span className="text-xs text-text-muted">{formatDhakaDateTime(c.last_message_at)}</span>
              </Link>
            );
          })}

          {(pendingOrderCount ?? 0) > 0 && (
            <Link href="/dashboard/orders" className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="flex items-center gap-2.5 text-sm text-text">
                <ShieldCheck className="h-4 w-4 shrink-0 text-text-muted" />
                <span>নতুন অর্ডার অপেক্ষমান</span>
              </div>
              <Badge variant="warning">{pendingOrderCount}টা</Badge>
            </Link>
          )}

          {!lastCampaign && (recentConversations ?? []).length === 0 && (pendingOrderCount ?? 0) === 0 && (
            <p className="py-3 text-sm text-text-muted">এখনো কোনো কার্যক্রম নেই।</p>
          )}
        </div>
      </Card>

      {isSuperAdmin && (
        <Link href="/dashboard/admin/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          🔑 অ্যাডমিন: পেমেন্ট রিভিউ <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-xl font-semibold text-text">{value}</p>
        {sub && <p className="text-xs text-text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50"
    >
      {icon}
      {label}
    </Link>
  );
}

function WeeklyMessageChart({ data }: { data: DayCount[] }) {
  const allZero = data.every((d) => d.sent === 0 && d.delivered === 0 && d.failed === 0);

  if (allZero) {
    return <p className="py-10 text-center text-sm text-text-muted">এই সপ্তাহে এখনো কোনো মেসেজ পাঠানো হয়নি।</p>;
  }

  const max = Math.max(1, ...data.flatMap((d) => [d.sent, d.delivered, d.failed]));
  const chartHeight = 120;
  const barWidth = 10;
  const barGap = 3;
  const groupWidth = CHART_SERIES.length * barWidth + (CHART_SERIES.length - 1) * barGap;
  const groupGap = 22;
  const totalWidth = data.length * groupWidth + (data.length - 1) * groupGap;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {CHART_SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${totalWidth} ${chartHeight + 22}`} className="h-auto w-full">
        {data.map((d, i) => {
          const groupX = i * (groupWidth + groupGap);
          return (
            <g key={i}>
              {CHART_SERIES.map((s, si) => {
                const value = d[s.key];
                const barHeight = Math.max((value / max) * chartHeight, value > 0 ? 2 : 0);
                const x = groupX + si * (barWidth + barGap);
                const y = chartHeight - barHeight;
                return (
                  <rect key={s.key} x={x} y={y} width={barWidth} height={barHeight} rx={3} fill={s.color}>
                    <title>{`${d.label}: ${s.label} ${value}`}</title>
                  </rect>
                );
              })}
              <text x={groupX + groupWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
