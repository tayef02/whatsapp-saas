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
  MessageSquare,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDhakaDateTime, getDhakaDayBoundariesUtc } from "@/lib/format-date";
import OnboardingChecklist from "./OnboardingChecklist";

const MESSENGER_ENABLED = process.env.NEXT_PUBLIC_MESSENGER_ENABLED === "true";

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

type ChartSeriesDef = { key: string; color: string; label: string };
type ChartDay = { label: string } & Record<string, number | string>;

const WHATSAPP_CHART_SERIES: ChartSeriesDef[] = [
  { key: "sent", color: "var(--color-info)", label: "পাঠানো" },
  { key: "delivered", color: "var(--color-success)", label: "ডেলিভার্ড" },
  { key: "failed", color: "var(--color-danger)", label: "ব্যর্থ" },
];

const MESSENGER_CHART_SERIES: ChartSeriesDef[] = [
  { key: "inbound", color: "var(--color-info)", label: "কাস্টমারের মেসেজ" },
  { key: "outbound", color: "var(--color-success)", label: "রিপ্লাই" },
];

// Phase ১ (চ্যানেল বিচ্ছিন্নতা): "সব" ট্যাব সরানো হয়েছে — আগে এটা আসলে কোনো cross-channel
// aggregation করত না, শুধু WhatsApp ট্যাবের হুবহু একই কন্টেন্ট দেখাত। এখন প্রতিটা ট্যাব
// (WhatsApp/Messenger) শুধু নিজের চ্যানেলের স্ট্যাট/চার্ট/কার্যক্রম কোয়েরি করে — কোনো কোয়েরিতেই
// অন্য চ্যানেলের ডেটা মেশে না। "প্ল্যান ব্যবহার" কার্ড অ্যাকাউন্ট-লেভেল বলে ট্যাবের বাইরে, দুই
// ট্যাবেই অভিন্নভাবে দেখায়।
export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  // ফ্ল্যাগ বন্ধ থাকলে (ডিফল্ট) চ্যানেল ট্যাব দেখানোই হয় না, channel সবসময় "whatsapp" —
  // Messenger কোয়েরি/কন্টেন্ট কখনো রেন্ডার হয় না, WhatsApp ড্যাশবোর্ড আগের মতোই
  const rawChannel = MESSENGER_ENABLED ? (await searchParams).channel : undefined;
  const channel: "whatsapp" | "messenger" = MESSENGER_ENABLED && rawChannel === "messenger" ? "messenger" : "whatsapp";

  const channelTabs = MESSENGER_ENABLED && (
    <div className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
      <ChannelTab href="/dashboard" active={channel === "whatsapp"} label="WhatsApp" />
      <ChannelTab href="/dashboard?channel=messenger" active={channel === "messenger"} label="Messenger" />
    </div>
  );

  const supabase = await createClient();

  // অ্যাকাউন্ট-লেভেল — চ্যানেল যা-ই হোক একবারই কোয়েরি হয়, দুই ট্যাবেই একই কার্ড/লিংক দেখা যাবে
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  const { data: membership } = await supabase
    .from("workspace_members")
    .select(
      "workspace_id, workspaces(daily_message_limit, messages_used_this_cycle, subscription_expires_at, plans(name, monthly_message_limit))"
    )
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as {
    daily_message_limit: number;
    messages_used_this_cycle: number;
    subscription_expires_at: string | null;
    plans: { name: string; monthly_message_limit: number } | null;
  } | null;

  const monthlyLimit = workspace?.plans?.monthly_message_limit ?? 0;
  const usedThisCycle = workspace?.messages_used_this_cycle ?? 0;
  // rawPct রাউন্ড করার আগেই রাখা হচ্ছে — নাহলে 46/30000 এর মতো ছোট ব্যবহার Math.round এ 0% দেখাত,
  // যেটা "কিছুই ব্যবহার হয়নি" মনে হতে পারত
  const rawUsagePct = monthlyLimit > 0 ? (usedThisCycle / monthlyLimit) * 100 : 0;
  const monthlyUsagePct = Math.min(100, Math.round(rawUsagePct));
  const usagePctLabel = usedThisCycle > 0 && rawUsagePct < 1 ? "<১%" : `${monthlyUsagePct}%`;
  const usageBarWidthPct = usedThisCycle > 0 ? Math.max(rawUsagePct, 1) : 0;

  // হলুদ ব্যানার — প্ল্যানের মেয়াদ ৭ দিনের কম বাকি, বা এই মাসের মেসেজ কোটা ৮০%+ ব্যবহার হয়ে
  // গেছে (দুটোই বিদ্যমান ডেটা থেকে, কোনো নতুন কলাম/ক্রন লাগেনি — subscription-maintenance.ts
  // এ ইতিমধ্যে ব্যবহৃত subscription_expires_at কলামই এখানেও reuse হচ্ছে)
  const daysUntilExpiry = workspace?.subscription_expires_at
    ? Math.ceil((new Date(workspace.subscription_expires_at).getTime() - Date.now()) / (24 * 3_600_000))
    : null;
  const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;
  const usageHigh = monthlyLimit > 0 && monthlyUsagePct >= 80;

  const usageBanner = (expiringSoon || usageHigh) && (
    <div className="flex items-center gap-3 rounded-lg bg-warning-light px-4 py-3 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1">
        {expiringSoon &&
          (daysUntilExpiry !== null && daysUntilExpiry <= 0
            ? "আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে। "
            : `আপনার প্ল্যানের মেয়াদ আর ${(daysUntilExpiry ?? 0).toLocaleString("bn-BD")} দিন বাকি। `)}
        {usageHigh && `এই মাসের মেসেজ কোটার ${usagePctLabel} ব্যবহার হয়ে গেছে। `}
        রিনিউ/আপগ্রেড করতে প্ল্যান পেজে যান।
      </p>
      <Link href="/dashboard/billing" className="shrink-0 font-medium underline">
        প্ল্যান দেখুন
      </Link>
    </div>
  );

  // ⚠️ এই কাউন্ট এখন পর্যন্ত শুধু WhatsApp ক্যাম্পেইন/ওয়েবহুক কোড ইনক্রিমেন্ট করে
  // (apply_message_status RPC) — Messenger এর কোনো মেসেজ এখনো এই কোটায় গোনা হয় না (জানা
  // সীমাবদ্ধতা, docs/messenger-plan.md এর Phase ১ সেকশনে বিস্তারিত)
  const planUsageCard = (
    <Card className="self-start">
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
              style={{ width: `${usageBarWidthPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">{usagePctLabel} ব্যবহার হয়েছে এই সাইকেলে (এখন শুধু WhatsApp মেসেজ গোনা হয়)</p>
          <Link href="/dashboard/billing" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            প্ল্যান দেখুন <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      ) : (
        <p className="text-sm text-text-muted">কোনো active প্ল্যান নেই।</p>
      )}
    </Card>
  );

  const adminLink = isSuperAdmin && (
    <Link href="/dashboard/admin/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
      🔑 অ্যাডমিন: পেমেন্ট রিভিউ <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );

  if (channel === "messenger") {
    const { count: pagesCount } = await supabase.from("messenger_pages").select("id", { count: "exact", head: true }).eq("status", "active");

    // এখনো কোনো পেজ কানেক্ট করা না থাকলে কোনো conversations/messages কোয়েরি চালানোর
    // দরকার নেই — সরাসরি গাইড কার্ড
    if (!pagesCount) {
      return (
        <div className="flex flex-col gap-6">
          {channelTabs}
          {usageBanner}
          <EmptyState
            icon={<MessageSquare className="h-10 w-10" />}
            title="এখনো কোনো Facebook পেজ কানেক্ট করা হয়নি"
            description="একটা Facebook পেজ কানেক্ট করলে এখানে Messenger এর স্ট্যাট দেখা যাবে।"
            action={
              <Link
                href="/dashboard/messenger"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <MessageSquare className="h-4 w-4" /> প্রথম Facebook পেজ কানেক্ট করুন
              </Link>
            }
          />
        </div>
      );
    }

    const { count: conversationsCount } = await supabase.from("messenger_conversations").select("id", { count: "exact", head: true });
    const { count: handedOffCount } = await supabase
      .from("messenger_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "handed_off");

    const { startIso: todayStart } = getDhakaDayBoundariesUtc(0);
    const { count: todayMessagesCount } = await supabase
      .from("messenger_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart);

    const { count: pendingMessengerOrderCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("channel", "messenger")
      .eq("status", "pending");

    // অনবোর্ডিং চেকলিস্ট — Messenger এর নিজস্ব AI সেটিংস টেবিল (Phase ১, migration 0045)
    const { data: messengerAiSettings } = await supabase
      .from("messenger_ai_settings")
      .select("llm_provider, api_key_secret_id")
      .maybeSingle();
    const messengerBotSetup = Boolean(messengerAiSettings?.llm_provider && messengerAiSettings?.api_key_secret_id);

    const messengerChecklist = (
      <OnboardingChecklist
        title="Messenger শুরু করার ধাপ"
        items={[
          { label: "প্রথম Facebook পেজ কানেক্ট", done: true },
          { label: "বট সেটআপ (AI চ্যাটবট, provider + API key)", done: messengerBotSetup, href: "/dashboard/messenger/ai-chatbot" },
          { label: "প্রথম কমেন্ট রুল", done: false, note: "(কমেন্ট অটোমেশন শীঘ্রই আসছে)" },
        ]}
      />
    );

    const { data: handedOffConversations } = await supabase
      .from("messenger_conversations")
      .select("id, customer_name, psid, last_message_at")
      .eq("status", "handed_off")
      .order("last_message_at", { ascending: false })
      .limit(3);

    // গত ৭ দিনের ইনবাউন্ড/আউটবাউন্ড মেসেজ — WhatsApp এর একই bucket-by-day প্যাটার্ন
    const { startIso: weekStart } = getDhakaDayBoundariesUtc(6);
    const { data: weekMessages } = await supabase
      .from("messenger_messages")
      .select("direction, created_at")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: true });

    const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const { startIso, endIso } = getDhakaDayBoundariesUtc(daysAgo);
      const dayMessages = (weekMessages ?? []).filter((m) => m.created_at >= startIso && m.created_at < endIso);
      return {
        label: new Date(startIso).toLocaleDateString("bn-BD", { weekday: "short", timeZone: "Asia/Dhaka" }),
        inbound: dayMessages.filter((m) => m.direction === "inbound").length,
        outbound: dayMessages.filter((m) => m.direction === "outbound").length,
      };
    });

    return (
      <div className="flex flex-col gap-6">
        {channelTabs}
        {usageBanner}
        {messengerChecklist}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<MessageSquare className="h-5 w-5" />} label="কানেক্টেড পেজ" value={`${pagesCount ?? 0}`} />
          <StatCard icon={<Users className="h-5 w-5" />} label="মোট কথোপকথন" value={`${conversationsCount ?? 0}`} />
          <StatCard icon={<Send className="h-5 w-5" />} label="আজকের মেসেজ" value={`${todayMessagesCount ?? 0}`} />
          <StatCard icon={<MessageCircleWarning className="h-5 w-5" />} label="এজেন্ট দরকার" value={`${handedOffCount ?? 0}`} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <p className="mb-4 text-sm font-semibold text-text">গত ৭ দিনের মেসেজ</p>
            <WeeklyBarChart data={chartData} series={MESSENGER_CHART_SERIES} />
          </Card>
          {planUsageCard}
        </div>

        <Card>
          <p className="mb-3 text-sm font-semibold text-text">সাম্প্রতিক কার্যক্রম</p>
          <div className="flex flex-col divide-y divide-border">
            {(handedOffConversations ?? []).map((c) => (
              <Link key={c.id} href={`/dashboard/messenger/inbox/${c.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 items-center gap-2.5 text-sm text-text">
                  <MessageCircleWarning className="h-4 w-4 shrink-0 text-danger" />
                  <span className="truncate">
                    এজেন্ট দরকার: <strong className="font-medium">{c.customer_name || c.psid}</strong>
                  </span>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-text-muted">{formatDhakaDateTime(c.last_message_at)}</span>
              </Link>
            ))}

            {(pendingMessengerOrderCount ?? 0) > 0 && (
              <Link href="/dashboard/messenger/orders" className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 items-center gap-2.5 text-sm text-text">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="truncate">নতুন অর্ডার অপেক্ষমান</span>
                </div>
                <Badge variant="warning" className="shrink-0">
                  {pendingMessengerOrderCount}টা
                </Badge>
              </Link>
            )}

            {(handedOffConversations ?? []).length === 0 && (pendingMessengerOrderCount ?? 0) === 0 && (
              <p className="py-3 text-sm text-text-muted">এখনো কোনো কার্যক্রম নেই।</p>
            )}
          </div>
        </Card>

        <Link href="/dashboard/messenger/inbox" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Inbox className="h-3.5 w-3.5" /> ইনবক্সে যান
        </Link>

        {adminLink}
      </div>
    );
  }

  const { count: totalNumbersCount } = await supabase.from("whatsapp_numbers").select("id", { count: "exact", head: true });
  const { count: onlineNumbersCount } = await supabase
    .from("whatsapp_numbers")
    .select("id", { count: "exact", head: true })
    .eq("status", "online");

  const { count: contactsCount } = await supabase.from("contacts").select("id", { count: "exact", head: true });

  const { count: activeCampaignsCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "sending"]);

  // অনবোর্ডিং চেকলিস্ট — "প্রথম ক্যাম্পেইন" মানে status যাই হোক, অন্তত একটা তৈরি হয়েছে
  const { count: totalCampaignsCount } = await supabase.from("campaigns").select("id", { count: "exact", head: true });
  const { data: whatsappAiSettings } = await supabase.from("workspace_ai_settings").select("llm_provider, api_key_secret_id").maybeSingle();
  const whatsappBotSetup = Boolean(whatsappAiSettings?.llm_provider && whatsappAiSettings?.api_key_secret_id);

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

  // channel ফিল্টার যোগ হয়েছে — আগে Messenger এর pending অর্ডারও এখানে ভুলে গোনা হতো
  const { count: pendingOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("channel", "whatsapp")
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

  const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
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
  const hasNoNumbers = (totalNumbersCount ?? 0) === 0;

  const whatsappChecklist = (
    <OnboardingChecklist
      title="WhatsApp শুরু করার ধাপ"
      items={[
        { label: "WhatsApp নাম্বার কানেক্ট", done: !hasNoNumbers, href: "/dashboard/numbers/new" },
        { label: "বট সেটআপ (AI চ্যাটবট, provider + API key)", done: whatsappBotSetup, href: "/dashboard/ai-chatbot" },
        { label: "প্রথম কন্টাক্ট যোগ", done: (contactsCount ?? 0) > 0, href: "/dashboard/contacts/new" },
        { label: "প্রথম ক্যাম্পেইন তৈরি", done: (totalCampaignsCount ?? 0) > 0, href: "/dashboard/campaigns/new" },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {channelTabs}
      {usageBanner}
      {whatsappChecklist}

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
        <StatCard icon={<Megaphone className="h-5 w-5" />} label="চলমান ক্যাম্পেইন" value={`${activeCampaignsCount ?? 0}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* গত ৭ দিনের মেসেজ চার্ট */}
        <Card className="lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-text">গত ৭ দিনের মেসেজ</p>
          <WeeklyBarChart data={chartData} series={WHATSAPP_CHART_SERIES} />
        </Card>

        {planUsageCard}
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
              <div className="flex min-w-0 items-center gap-2.5 text-sm text-text">
                <Megaphone className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="truncate">
                  সর্বশেষ ক্যাম্পেইন: <strong className="font-medium">{lastCampaign.name}</strong>
                </span>
              </div>
              <Badge variant={campaignStatusVariant[lastCampaign.status] ?? "neutral"} className="shrink-0">
                {campaignStatusLabel[lastCampaign.status] ?? lastCampaign.status}
              </Badge>
            </Link>
          )}

          {(recentConversations ?? []).map((c) => {
            const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
            return (
              <Link key={c.id} href={`/dashboard/inbox/${c.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 items-center gap-2.5 text-sm text-text">
                  {c.status === "handed_off" ? (
                    <MessageCircleWarning className="h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <Users className="h-4 w-4 shrink-0 text-text-muted" />
                  )}
                  <span className="truncate">
                    {c.status === "handed_off" ? "এজেন্ট দরকার: " : "ইনবক্স: "}
                    <strong className="font-medium">{contact?.name || contact?.phone || "(অজানা)"}</strong>
                  </span>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-text-muted">{formatDhakaDateTime(c.last_message_at)}</span>
              </Link>
            );
          })}

          {(pendingOrderCount ?? 0) > 0 && (
            <Link href="/dashboard/orders" className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 items-center gap-2.5 text-sm text-text">
                <ShieldCheck className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="truncate">নতুন অর্ডার অপেক্ষমান</span>
              </div>
              <Badge variant="warning" className="shrink-0">
                {pendingOrderCount}টা
              </Badge>
            </Link>
          )}

          {!lastCampaign && (recentConversations ?? []).length === 0 && (pendingOrderCount ?? 0) === 0 && (
            <p className="py-3 text-sm text-text-muted">এখনো কোনো কার্যক্রম নেই।</p>
          )}
        </div>
      </Card>

      {adminLink}
    </div>
  );
}

function ChannelTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-primary-light text-primary" : "text-text-muted hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-2xl font-semibold text-text">{value}</p>
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

// WhatsApp এর sent/delivered/failed আর Messenger এর inbound/outbound — দুই সেট ভিন্ন সিরিজ,
// তাই series এখন prop (আগে module-level constant ছিল, শুধু WhatsApp এর জন্য হার্ডকোডেড)
function WeeklyBarChart({ data, series }: { data: ChartDay[]; series: ChartSeriesDef[] }) {
  const allZero = data.every((d) => series.every((s) => Number(d[s.key] ?? 0) === 0));

  if (allZero) {
    return <p className="py-10 text-center text-sm text-text-muted">এই সপ্তাহে এখনো কোনো মেসেজ হয়নি।</p>;
  }

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0))));
  const chartHeight = 200;
  const barWidth = 6;
  const barGap = 2;
  const groupWidth = series.length * barWidth + (series.length - 1) * barGap;
  const groupGap = 16;
  const totalWidth = data.length * groupWidth + (data.length - 1) * groupGap;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      {/* দিনের নাম SVG এর ভেতরে না রেখে সাধারণ HTML টেক্সট হিসেবে নিচে বসানো হয়েছে — SVG এর
          viewBox স্কেলিং এ ভেতরের <text> চওড়া কার্ডে অনেক বড় দেখাচ্ছিল (11-12px না, actual render
          অনেক বেশি হয়ে যাচ্ছিল), HTML টেক্সট viewport যাই হোক ফন্ট সাইজ ঠিক রাখে */}
      <svg viewBox={`0 0 ${totalWidth} ${chartHeight}`} preserveAspectRatio="none" className="h-[200px] w-full">
        {data.map((d, i) => {
          const groupX = i * (groupWidth + groupGap);
          return (
            <g key={i}>
              {series.map((s, si) => {
                const value = Number(d[s.key] ?? 0);
                const barHeight = Math.max((value / max) * chartHeight, value > 0 ? 2 : 0);
                const x = groupX + si * (barWidth + barGap);
                const y = chartHeight - barHeight;
                return (
                  <rect key={s.key} x={x} y={y} width={barWidth} height={barHeight} rx={2} fill={s.color}>
                    <title>{`${d.label}: ${s.label} ${value}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[11px] text-text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
