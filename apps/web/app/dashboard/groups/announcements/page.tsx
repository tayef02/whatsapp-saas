import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnnouncementsList from "./AnnouncementsList";

export default async function GroupAnnouncementsPage() {
  const supabase = await createClient();

  const { data: groups } = await supabase.from("groups").select("id, name").order("name", { ascending: true });

  const { data: announcements } = await supabase
    .from("group_scheduled_announcements")
    .select("id, message_text, poll_options, poll_multi_select, scheduled_at, status, created_at")
    .order("scheduled_at", { ascending: false })
    .limit(50);

  const { data: targets } = await supabase
    .from("group_scheduled_announcement_targets")
    .select("id, announcement_id, group_id, status, error_message, sent_at, groups(name)");

  const targetsByAnnouncement = new Map<
    string,
    { group_name: string | null; status: string; error_message: string | null; sent_at: string | null }[]
  >();
  for (const t of targets ?? []) {
    const group = Array.isArray(t.groups) ? t.groups[0] : t.groups;
    const list = targetsByAnnouncement.get(t.announcement_id) ?? [];
    list.push({ group_name: group?.name ?? null, status: t.status, error_message: t.error_message, sent_at: t.sent_at });
    targetsByAnnouncement.set(t.announcement_id, list);
  }

  const announcementsWithTargets = (announcements ?? []).map((a) => ({
    ...a,
    targets: targetsByAnnouncement.get(a.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/groups" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> গ্রুপ লিস্টে ফিরুন
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-text">শিডিউলড অ্যানাউন্সমেন্ট/পোল</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          নির্দিষ্ট সময়ে এক বা একাধিক গ্রুপে টেক্সট বা পোল পাঠান। একাধিক গ্রুপ বাছাই করলে সবগুলোতে একসাথে না, ধীরে ধীরে
          (১-৩ মিনিট র‍্যান্ডম গ্যাপে) পাঠানো হবে — স্প্যামের মতো না লাগার জন্য।
        </p>
      </div>
      <AnnouncementsList groups={groups ?? []} announcements={announcementsWithTargets} />
    </div>
  );
}
