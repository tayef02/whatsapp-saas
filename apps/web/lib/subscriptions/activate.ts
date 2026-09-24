import type { createAdminClient } from "@/lib/supabase/admin";

// একটা পেমেন্ট approve হলে (এখন ম্যানুয়াল, পরে সত্যিকারের গেটওয়ের webhook থেকেও)
// এই একই ফাংশন কল হবে — তাই নতুন গেটওয়ে যোগ করার সময় অ্যাক্টিভেশন লজিক আবার লিখতে হবে না।
export async function activateSubscription(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  planId: string
) {
  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("duration_days")
    .eq("id", planId)
    .single();

  if (planError || !plan) throw new Error(planError?.message ?? "প্ল্যান পাওয়া যায়নি");

  const { data: workspace } = await admin
    .from("workspaces")
    .select("subscription_expires_at")
    .eq("id", workspaceId)
    .single();

  const now = new Date();
  const currentExpiry = workspace?.subscription_expires_at ? new Date(workspace.subscription_expires_at) : null;
  // এখনো মেয়াদ বাকি থাকতে নতুন পেমেন্ট করলে আগের মেয়াদ শেষ থেকে যোগ হবে, নাহলে এখন থেকে
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(base.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

  const { error } = await admin
    .from("workspaces")
    .update({
      plan_id: planId,
      subscription_status: "active",
      subscription_started_at: now.toISOString(),
      subscription_expires_at: newExpiry.toISOString(),
      messages_used_this_cycle: 0,
    })
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);
}
