"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderForNumber } from "@/lib/provider-for-number";

// Evolution থেকে এই নাম্বারের সব গ্রুপ + মেম্বার/অ্যাডমিন লিস্ট টেনে আনে, groups/group_members
// টেবিলে upsert করে। Evolution ই source of truth — তাই প্রতিটা গ্রুপের মেম্বার লিস্ট sync
// করার সময় পুরোনোটা মুছে নতুনটা বসানো হয় (কেউ leave/join করলে যেন পুরনো ডাটা না থেকে যায়)
export async function syncGroups(numberId: string) {
  const supabase = await createClient();

  // RLS-স্কোপড ক্লায়েন্ট দিয়ে যাচাই — এই নাম্বার সত্যিই কলারের workspace এর কিনা
  const { data: number } = await supabase.from("whatsapp_numbers").select("id, workspace_id").eq("id", numberId).maybeSingle();
  if (!number) return { error: "নাম্বার পাওয়া যায়নি" };

  const providerInfo = await getProviderForNumber(numberId);
  if (!providerInfo) return { error: "Evolution সার্ভার তথ্য পাওয়া যায়নি" };

  let groups;
  try {
    groups = await providerInfo.provider.listGroups(providerInfo.instanceName);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "গ্রুপ লিস্ট আনা যায়নি" };
  }

  const admin = createAdminClient();

  for (const g of groups) {
    const { data: groupRow, error } = await admin
      .from("groups")
      .upsert(
        {
          workspace_id: number.workspace_id,
          whatsapp_number_id: numberId,
          group_jid: g.groupJid,
          name: g.name,
          description: g.description,
          member_count: g.participants.length,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp_number_id,group_jid" }
      )
      .select("id")
      .maybeSingle();

    if (error || !groupRow) continue;

    await admin.from("group_members").delete().eq("group_id", groupRow.id);
    if (g.participants.length > 0) {
      await admin.from("group_members").insert(
        g.participants.map((p) => ({
          group_id: groupRow.id,
          workspace_id: number.workspace_id,
          phone: p.jid.replace(/@.*/, ""),
          is_group_admin: p.isAdmin,
        }))
      );
    }
  }

  revalidatePath("/dashboard/groups");
  return { error: null, count: groups.length };
}

export async function getInviteLink(groupId: string) {
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, whatsapp_number_id, group_jid").eq("id", groupId).maybeSingle();
  if (!group) return { error: "গ্রুপ পাওয়া যায়নি" };

  const providerInfo = await getProviderForNumber(group.whatsapp_number_id);
  if (!providerInfo) return { error: "Evolution সার্ভার তথ্য পাওয়া যায়নি" };

  try {
    const inviteCode = await providerInfo.provider.getGroupInviteCode(providerInfo.instanceName, group.group_jid);
    await createAdminClient().from("groups").update({ invite_code: inviteCode }).eq("id", groupId);
    revalidatePath("/dashboard/groups");
    return { error: null, inviteCode };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ইনভাইট লিংক আনা যায়নি" };
  }
}

export async function rotateInviteLink(groupId: string) {
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, whatsapp_number_id, group_jid").eq("id", groupId).maybeSingle();
  if (!group) return { error: "গ্রুপ পাওয়া যায়নি" };

  const providerInfo = await getProviderForNumber(group.whatsapp_number_id);
  if (!providerInfo) return { error: "Evolution সার্ভার তথ্য পাওয়া যায়নি" };

  try {
    const inviteCode = await providerInfo.provider.revokeGroupInviteCode(providerInfo.instanceName, group.group_jid);
    await createAdminClient().from("groups").update({ invite_code: inviteCode }).eq("id", groupId);
    revalidatePath("/dashboard/groups");
    return { error: null, inviteCode };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ইনভাইট লিংক রোটেট করা যায়নি" };
  }
}
