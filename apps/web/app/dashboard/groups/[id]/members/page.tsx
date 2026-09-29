import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MembersList from "./MembersList";

export default async function GroupMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id").eq("id", id).maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, phone, name, is_group_admin, is_flagged, flag_reason, last_activity_at")
    .eq("group_id", id)
    .order("is_flagged", { ascending: false })
    .order("name", { ascending: true });

  return <MembersList members={members ?? []} />;
}
