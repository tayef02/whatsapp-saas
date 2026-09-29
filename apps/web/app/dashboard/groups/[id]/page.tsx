import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupOverview from "./GroupOverview";

export default async function GroupOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, description, member_count, invite_code, is_admin_only_mode, max_daily_scheduled_messages, last_synced_at")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { count: adminCount } = await supabase
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id)
    .eq("is_group_admin", true);

  return <GroupOverview group={group} adminCount={adminCount ?? 0} />;
}
