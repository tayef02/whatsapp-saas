"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderForNumber } from "@/lib/provider-for-number";

// Evolution থেকে এই নাম্বারের সব গ্রুপ + মেম্বার/অ্যাডমিন লিস্ট টেনে আনে, groups/group_members
// টেবিলে upsert করে। মেম্বার লিস্ট upsert হয় (delete+insert না) — কারণ last_activity_at/
// is_flagged/flag_reason (inactive/spam auto-flag ফিচার) প্রতিটা re-sync এ হারিয়ে যাওয়া উচিত
// না। যারা গ্রুপ ছেড়ে দিয়েছে (Evolution এর লিস্টে আর নেই) তাদের row আলাদাভাবে মুছে ফেলা হয়
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

    const currentPhones = g.participants.map((p) => p.jid.split("@")[0].split(":")[0]);

    if (currentPhones.length > 0) {
      await admin.from("group_members").upsert(
        g.participants.map((p) => ({
          group_id: groupRow.id,
          workspace_id: number.workspace_id,
          // WhatsApp multi-device JID তে মাঝেমধ্যে ":deviceId" সাফিক্স থাকে — শুধু "@..." কাটলে
          // সেটা থেকে যেত, worker এর অ্যাডমিন-চেক তখন বটের নিজের row খুঁজে পেত না
          phone: p.jid.split("@")[0].split(":")[0],
          is_group_admin: p.isAdmin,
        })),
        { onConflict: "group_id,phone" }
      );
    }

    // যারা আর গ্রুপে নেই (leave করেছে) তাদের row মুছে ফেলা — বাকিদের last_activity_at/
    // is_flagged upsert এ স্পর্শ হয়নি, তাই অক্ষত থাকে
    const { data: existingMembers } = await admin.from("group_members").select("id, phone").eq("group_id", groupRow.id);
    const staleIds = (existingMembers ?? []).filter((m) => !currentPhones.includes(m.phone)).map((m) => m.id);
    if (staleIds.length > 0) {
      await admin.from("group_members").delete().in("id", staleIds);
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

export async function toggleAdminOnlyMode(groupId: string, adminOnly: boolean) {
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, whatsapp_number_id, group_jid").eq("id", groupId).maybeSingle();
  if (!group) return { error: "গ্রুপ পাওয়া যায়নি" };

  const providerInfo = await getProviderForNumber(group.whatsapp_number_id);
  if (!providerInfo) return { error: "Evolution সার্ভার তথ্য পাওয়া যায়নি" };

  try {
    await providerInfo.provider.setGroupAdminOnlyMode(providerInfo.instanceName, group.group_jid, adminOnly);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "গ্রুপ সেটিং বদলানো যায়নি" };
  }

  const { error } = await supabase.from("groups").update({ is_admin_only_mode: adminOnly }).eq("id", groupId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups");
  return { error: null };
}

export async function updateMaxDailyScheduled(groupId: string, maxPerDay: number) {
  const supabase = await createClient();
  if (!Number.isFinite(maxPerDay) || maxPerDay < 0) return { error: "সঠিক সংখ্যা দিন" };

  const { error } = await supabase.from("groups").update({ max_daily_scheduled_messages: Math.round(maxPerDay) }).eq("id", groupId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups");
  return { error: null };
}

// মেম্বার কখনো auto-remove হয় না — শুধু flag/unflag। remove করার সিদ্ধান্ত admin নিজে
// WhatsApp এ গিয়ে ম্যানুয়ালি নেবে
export async function unflagMember(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("group_members").update({ is_flagged: false, flag_reason: null }).eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups");
  return { error: null };
}

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

// workspace-ভিত্তিক ব্যানড-ওয়ার্ড/লিংক-প্যাটার্ন লিস্ট (সব গ্রুপে প্রযোজ্য, প্রতি গ্রুপে আলাদা না)
export async function updateGroupFilters(bannedWords: string[], bannedLinkPatterns: string[]) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const { error } = await supabase.from("workspace_group_filters").upsert(
    { workspace_id: workspaceId, banned_words: bannedWords, banned_link_patterns: bannedLinkPatterns },
    { onConflict: "workspace_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups");
  return { error: null };
}

export async function updateWelcomeSettings(groupId: string, enabled: boolean, message: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ welcome_enabled: enabled, welcome_message: message.trim() || null })
    .eq("id", groupId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups");
  return { error: null };
}

// নতুন GROUP_PARTICIPANTS_UPDATE ইভেন্ট আগে থেকে কানেক্টেড নাম্বারে পেতে হলে একবার webhook
// রিসেট করা লাগে (QR আবার স্ক্যান করার দরকার নেই)
export async function resyncWebhook(numberId: string) {
  const supabase = await createClient();
  const { data: number } = await supabase.from("whatsapp_numbers").select("id").eq("id", numberId).maybeSingle();
  if (!number) return { error: "নাম্বার পাওয়া যায়নি" };

  const providerInfo = await getProviderForNumber(numberId);
  if (!providerInfo) return { error: "Evolution সার্ভার তথ্য পাওয়া যায়নি" };

  const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/evolution` : undefined;
  if (!webhookUrl) return { error: "APP_URL সেট করা নেই, webhook resync করা যাবে না" };

  try {
    await providerInfo.provider.setWebhook(providerInfo.instanceName, webhookUrl);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Webhook resync করা যায়নি" };
  }
}
