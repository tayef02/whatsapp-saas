import { getSupabase } from "./supabase";
import { createNotification } from "./notify";

// নাম্বার ডিসকানেক্ট/ব্যান হলে সেই নাম্বারে চলা সব ক্যাম্পেইন পজ করে দেয় —
// বাকি মেসেজ 'pending'/'scheduled' থেকেই যায়, 'failed' হয় না
export async function pauseCampaignsForNumber(numberId: string, workspaceId: string, reason: string) {
  const supabase = getSupabase();

  const { data: paused } = await supabase
    .from("campaigns")
    .update({ status: "paused", paused_reason: reason })
    .eq("whatsapp_number_id", numberId)
    .eq("status", "sending")
    .select("id");

  if (paused && paused.length > 0) {
    await createNotification(
      workspaceId,
      "campaign_auto_paused",
      "নাম্বার সমস্যার কারণে ক্যাম্পেইন থামানো হয়েছে",
      `${paused.length}টা চলমান ক্যাম্পেইন পজ করা হয়েছে। নাম্বার ঠিক করে আবার resume করুন।`
    );
  }
}
