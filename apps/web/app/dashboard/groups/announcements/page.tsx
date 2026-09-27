import Link from "next/link";
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
    .select("id, announcement_id, group_id, status, error_message, groups(name)");

  const targetsByAnnouncement = new Map<
    string,
    { group_name: string | null; status: string; error_message: string | null }[]
  >();
  for (const t of targets ?? []) {
    const group = Array.isArray(t.groups) ? t.groups[0] : t.groups;
    const list = targetsByAnnouncement.get(t.announcement_id) ?? [];
    list.push({ group_name: group?.name ?? null, status: t.status, error_message: t.error_message });
    targetsByAnnouncement.set(t.announcement_id, list);
  }

  const announcementsWithTargets = (announcements ?? []).map((a) => ({
    ...a,
    targets: targetsByAnnouncement.get(a.id) ?? [],
  }));

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard/groups">← গ্রুপ লিস্টে ফিরুন</Link>
      </p>
      <h1>শিডিউলড অ্যানাউন্সমেন্ট/পোল</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        নির্দিষ্ট সময়ে এক বা একাধিক গ্রুপে টেক্সট বা পোল পাঠান। একাধিক গ্রুপ বাছাই করলে সবগুলোতে একসাথে না, ধীরে ধীরে
        (১-৩ মিনিট র‍্যান্ডম গ্যাপে) পাঠানো হবে — স্প্যামের মতো না লাগার জন্য। প্রতি গ্রুপে দিনে সর্বোচ্চ কতগুলো
        শিডিউলড মেসেজ যাবে তার সীমা Groups পেজে প্রতিটা গ্রুপের নিজস্ব সেটিং (ডিফল্ট ৩টা/দিন)।
      </p>
      <AnnouncementsList groups={groups ?? []} announcements={announcementsWithTargets} />
    </div>
  );
}
