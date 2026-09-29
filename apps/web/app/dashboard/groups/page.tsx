import Link from "next/link";
import { CalendarClock, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import GroupsList from "./GroupsList";

export default async function GroupsPage() {
  const supabase = await createClient();

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name")
    .order("created_at", { ascending: false });

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, description, member_count, is_admin_only_mode, welcome_enabled, last_synced_at, whatsapp_numbers(display_name)")
    .order("name", { ascending: true });

  const { data: members } = await supabase.from("group_members").select("group_id, is_flagged");

  const { data: filters } = await supabase.from("workspace_group_filters").select("banned_words, banned_link_patterns").maybeSingle();
  const spamFilterActive = Boolean((filters?.banned_words?.length ?? 0) > 0 || (filters?.banned_link_patterns?.length ?? 0) > 0);

  const flaggedCountByGroup = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.is_flagged) flaggedCountByGroup.set(m.group_id, (flaggedCountByGroup.get(m.group_id) ?? 0) + 1);
  }

  const groupCards = (groups ?? []).map((g) => {
    const number = Array.isArray(g.whatsapp_numbers) ? g.whatsapp_numbers[0] : g.whatsapp_numbers;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      member_count: g.member_count,
      is_admin_only_mode: g.is_admin_only_mode,
      welcome_enabled: g.welcome_enabled,
      last_synced_at: g.last_synced_at,
      number_name: number?.display_name ?? null,
      flagged_count: flaggedCountByGroup.get(g.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text">WhatsApp গ্রুপ</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Evolution থেকে গ্রুপের নাম/বর্ণনা/মেম্বার/অ্যাডমিন লিস্ট নিচে "সিঙ্ক করুন" চাপলে sync হবে।
          </p>
        </div>
        <Link
          href="/dashboard/groups/announcements"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:bg-gray-50"
        >
          <CalendarClock className="h-4 w-4" /> শিডিউলড অ্যানাউন্সমেন্ট/পোল
        </Link>
      </div>

      {(!groups || groups.length === 0) ? (
        <EmptyState
          icon={<UsersRound className="h-10 w-10" />}
          title="এখনো কোনো গ্রুপ sync হয়নি"
          description='নিচে আপনার কানেক্টেড নাম্বার থেকে "সিঙ্ক করুন" চাপুন।'
        />
      ) : null}

      <GroupsList numbers={numbers ?? []} groups={groupCards} spamFilterActive={spamFilterActive} />
    </div>
  );
}
