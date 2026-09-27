import { getProviderForNumber } from "../lib/provider-for-number";
import { createNotification } from "../lib/notify";
import type { DeleteGroupMessageJobData } from "@whatsapp-saas/core/groups/types";

// filter ম্যাচ হলেই এই job বসে, আগে থেকে "bot অ্যাডমিন কিনা" চেক করা হয় না (WhatsApp এর LID
// প্রাইভেসি সিস্টেমের কারণে phone দিয়ে বটের নিজের group_members row নির্ভরযোগ্যভাবে খুঁজে
// পাওয়া যায় না) — WhatsApp/Evolution নিজেই পারমিশন না থাকলে এরর দেয়, সেটা এখানে catch করে
// admin কে নোটিফাই করা হয়
export async function processDeleteGroupMessage(data: DeleteGroupMessageJobData) {
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[group-moderation] no provider found for number=${data.whatsappNumberId}`);
    return;
  }

  try {
    await providerInfo.provider.deleteGroupMessage(providerInfo.instanceName, data.groupJid, {
      id: data.messageId,
      // মূল participant JID (phone-JID বা @lid, যেটাই ছিল) হুবহু ব্যবহার হচ্ছে — phone নাম্বার
      // দিয়ে পুনর্গঠন করলে LID-ভিত্তিক সেন্ডারের ক্ষেত্রে ভুল JID হয়ে যেত (mention ফিচারে
      // একই কারণে সমস্যা হয়েছিল, সেই একই রুট-কজ এখানেও প্রযোজ্য হতে পারে)
      participant: data.participantJid,
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
