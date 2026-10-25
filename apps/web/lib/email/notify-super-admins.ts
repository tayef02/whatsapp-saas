import { createAdminClient } from "@/lib/supabase/admin";

// সুপার অ্যাডমিনদের "ইমেইল" চ্যানেলের নোটিফিকেশন পাঠায়। notifications workspace-ভিত্তিক, তাই প্রতিটা
// সুপার অ্যাডমিনের নিজের (প্রথম) workspace এ রো বসে। একই type এর অপঠিত নোটিফিকেশন আগে থেকে থাকলে
// নতুন করে বসানো হয় না (একই বিষয়ে বারবার ভিড় না করতে)।
export async function notifySuperAdminsEmail(type: string, title: string, body?: string) {
  const admin = createAdminClient();
  const { data: admins } = await admin.from("super_admins").select("user_id");

  for (const row of admins ?? []) {
    const { data: membership } = await admin.from("workspace_members").select("workspace_id").eq("user_id", row.user_id).limit(1).maybeSingle();
    if (!membership) continue;

    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("workspace_id", membership.workspace_id)
      .eq("type", type)
      .eq("is_read", false)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    await admin.from("notifications").insert({ workspace_id: membership.workspace_id, type, title, body, channel: "email" });
  }
}
