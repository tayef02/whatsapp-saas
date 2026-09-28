import { getProviderForNumber } from "../lib/provider-for-number";
import type { DirectMessageJobData } from "@whatsapp-saas/core/chatbot/types";

// কনভারসেশন/গ্রুপ কোনোটাই নেই এমন কাস্টমারকে (যেমন গ্রুপ-অর্ডারের কাস্টমার) সরাসরি ১:১
// মেসেজ পাঠানোর জন্য — কোথাও কিছু লগ হয় না, শুধু sendMessage কল হয়
export async function processDirectMessage(data: DirectMessageJobData) {
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[direct-message] no provider found for number=${data.whatsappNumberId}`);
    return;
  }

  await providerInfo.provider.sendMessage(providerInfo.instanceName, data.phone, data.replyText);
  console.log(`[direct-message] sent to ${data.phone}`);
}
