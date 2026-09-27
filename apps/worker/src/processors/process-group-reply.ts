import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import type { GroupReplyJobData } from "@whatsapp-saas/core/groups/types";

// কিওয়ার্ড/mention ম্যাচ হলে webhook handler এই job বসায় — এখানে আসল sendMessage কল হয়
// (গ্রুপ JID টাই "to" হিসেবে যায়, Evolution এটা normal নাম্বারের মতোই হ্যান্ডেল করে)
export async function processGroupReply(data: GroupReplyJobData) {
  console.log(`[group-autoreply] job started: group=${data.groupJid}`);

  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[group-autoreply] no provider found for number=${data.whatsappNumberId}, skipping`);
    return;
  }

  await providerInfo.provider.sendMessage(providerInfo.instanceName, data.groupJid, data.replyText);
  console.log(`[group-autoreply] sendMessage succeeded, group=${data.groupJid}`);

  // পরের বার AI ট্রিগার হলে এই রিপ্লাইটাও কথোপকথনের ইতিহাসের অংশ হিসেবে থাকবে
  await getSupabase()
    .from("group_messages")
    .insert({ group_id: data.groupId, workspace_id: data.workspaceId, direction: "outbound", sender_name: "AI", content: data.replyText });
}
