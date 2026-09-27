import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import type { SendGroupAnnouncementJobData } from "@whatsapp-saas/core/groups/types";

// scheduler tick প্রতিটা টার্গেট গ্রুপের জন্য staggered delay দিয়ে এই job বসায় — এখানে
// আসল sendMessage/sendPoll কল হয়, সফল/ব্যর্থ দুটোই target row-তে লেখা হয় (রিপোর্টের জন্য)
export async function processSendGroupAnnouncement(data: SendGroupAnnouncementJobData) {
  const supabase = getSupabase();
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);

  if (!providerInfo) {
    console.error(`[group-announcement] no provider found for number=${data.whatsappNumberId}`);
    await supabase
      .from("group_scheduled_announcement_targets")
      .update({ status: "failed", error_message: "provider পাওয়া যায়নি" })
      .eq("id", data.targetId);
    return;
  }

  try {
    if (data.pollOptions && data.pollOptions.length > 0) {
      await providerInfo.provider.sendPoll(providerInfo.instanceName, data.groupJid, data.messageText, data.pollOptions, data.pollMultiSelect);
    } else {
      await providerInfo.provider.sendMessage(providerInfo.instanceName, data.groupJid, data.messageText);
    }

    await supabase
      .from("group_scheduled_announcement_targets")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.targetId);
    console.log(`[group-announcement] sent to group=${data.groupJid} (target=${data.targetId})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[group-announcement] failed to send to group=${data.groupJid} (target=${data.targetId}):`, message);
    await supabase.from("group_scheduled_announcement_targets").update({ status: "failed", error_message: message }).eq("id", data.targetId);
  }
}
