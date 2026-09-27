import { getProviderForNumber } from "../lib/provider-for-number";
import { createNotification } from "../lib/notify";
import type { DeleteGroupMessageJobData } from "@whatsapp-saas/core/groups/types";

// এই job শুধু তখনই বসে যখন webhook handler আগে থেকেই নিশ্চিত হয়ে গেছে bot গ্রুপে অ্যাডমিন
// (delete permission আছে) — তাই এখানে আলাদা permission চেক নেই। ব্যর্থ হলে (network/API
// এরর) admin কে নোটিফাই করা হয়, যাতে ম্যানুয়ালি দেখে নিতে পারে
export async function processDeleteGroupMessage(data: DeleteGroupMessageJobData) {
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[group-moderation] no provider found for number=${data.whatsappNumberId}`);
    return;
  }

  try {
    await providerInfo.provider.deleteGroupMessage(providerInfo.instanceName, data.groupJid, {
      id: data.messageId,
      participant: `${data.senderPhone}@s.whatsapp.net`,
      fromMe: false,
    });
    console.log(`[group-moderation] deleted message ${data.messageId} in group=${data.groupJid} (matched: "${data.matchedText}")`);
  } catch (err) {
    console.error(`[group-moderation] failed to delete message ${data.messageId} in group=${data.groupJid}:`, err instanceof Error ? err.message : err);
    await createNotification(
      data.workspaceId,
      "group_message_delete_failed",
      "গ্রুপ মেসেজ auto-delete ব্যর্থ হয়েছে",
      `একটা স্প্যাম/ব্যানড-ওয়ার্ড মেসেজ ("${data.matchedText}") অটোমেটিক ডিলিট করা যায়নি — গ্রুপে গিয়ে ম্যানুয়ালি দেখুন।`
    );
  }
}
