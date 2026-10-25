import { getSupabase } from "./supabase";
import { createNotification } from "./notify";

// সুপার অ্যাডমিনদের "ইমেইল" চ্যানেলের নোটিফিকেশন (যেমন প্ল্যাটফর্ম ডোমেইন যাচাই ভেঙে গেলে)।
// notifications workspace-ভিত্তিক, তাই প্রতিটা সুপার অ্যাডমিনের প্রথম workspace এ রো বসে।
// একই type এর অপঠিত নোটিফিকেশন থাকলে নতুন বসানো হয় না (প্রতিদিনের রিচেকে ভিড় না করতে)।
export async function notifySuperAdminsEmail(type: string, title: string, body?: string) {
  const supabase = getSupabase();
  const { data: admins } = await supabase.from("super_admins").select("user_id");

  for (const row of admins ?? []) {
    const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", row.user_id).limit(1).maybeSingle();
    if (!membership) continue;

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("workspace_id", membership.workspace_id)
      .eq("type", type)
      .eq("is_read", false)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    await createNotification(membership.workspace_id, type, title, "email", body);
  }
}
