import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";

// দিনে একবার চলে: মেয়াদ পার হওয়া workspace কে 'expired' করা (ডাটা মুছবে না,
// শুধু নতুন ক্যাম্পেইন/পাঠানো বন্ধ হবে — সেই চেক scheduler আর createCampaign এ আছে),
// আর মেয়াদ শেষের ৩ দিন আগে একবার নোটিফিকেশন
export async function runSubscriptionMaintenanceTick() {
  const supabase = getSupabase();
  const now = new Date();

  const { data: expired } = await supabase
    .from("workspaces")
    .update({ subscription_status: "expired" })
    .lte("subscription_expires_at", now.toISOString())
    .in("subscription_status", ["active", "trial"])
    .select("id");

  if (expired && expired.length > 0) {
    console.log(`[subscription-maintenance] ${expired.length}টা workspace এর মেয়াদ শেষ হয়েছে`);
  }

  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: expiringSoon } = await supabase
    .from("workspaces")
    .select("id, subscription_expires_at")
    .in("subscription_status", ["active", "trial"])
    .gte("subscription_expires_at", now.toISOString())
    .lte("subscription_expires_at", threeDaysFromNow.toISOString());

  for (const workspace of expiringSoon ?? []) {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("type", "subscription_expiring_soon")
      .gte("created_at", oneDayAgo)
      .maybeSingle();

    if (existing) continue; // আজকে ইতিমধ্যে নোটিফিকেশন দেওয়া হয়েছে

    await createNotification(
      workspace.id,
      "subscription_expiring_soon",
      "আপনার প্ল্যানের মেয়াদ শেষ হয়ে আসছে",
      `${new Date(workspace.subscription_expires_at as string).toLocaleDateString("bn-BD")} তারিখে মেয়াদ শেষ হবে। মেয়াদ শেষ হলে নতুন ক্যাম্পেইন পাঠানো যাবে না — এখনই রিনিউ করুন।`
    );
  }
}
