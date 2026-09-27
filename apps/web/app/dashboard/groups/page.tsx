import { createClient } from "@/lib/supabase/server";
import GroupsList from "./GroupsList";

export default async function GroupsPage() {
  const supabase = await createClient();

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name")
    .order("created_at", { ascending: false });

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, description, member_count, invite_code, last_synced_at, whatsapp_numbers(display_name)")
    .order("name", { ascending: true });

  const { data: members } = await supabase.from("group_members").select("group_id, phone, name, is_group_admin");

  const membersByGroup = new Map<string, { phone: string; name: string | null; is_group_admin: boolean }[]>();
  for (const m of members ?? []) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push({ phone: m.phone, name: m.name, is_group_admin: m.is_group_admin });
    membersByGroup.set(m.group_id, list);
  }

  const groupsWithMembers = (groups ?? []).map((g) => {
    const number = Array.isArray(g.whatsapp_numbers) ? g.whatsapp_numbers[0] : g.whatsapp_numbers;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      member_count: g.member_count,
      invite_code: g.invite_code,
      last_synced_at: g.last_synced_at,
      number_name: number?.display_name ?? null,
      members: membersByGroup.get(g.id) ?? [],
    };
  });

  return (
    <div>
      <h1>WhatsApp গ্রুপ</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Evolution থেকে গ্রুপের নাম/বর্ণনা/মেম্বার/অ্যাডমিন লিস্ট এখানে sync হবে। নিচে আপনার কানেক্টেড নাম্বার থেকে "সিঙ্ক করুন" চাপুন।
      </p>
      <GroupsList numbers={numbers ?? []} groups={groupsWithMembers} />
    </div>
  );
}
