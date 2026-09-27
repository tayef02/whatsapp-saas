import { getSupabase } from "../lib/supabase";

// এত দিন কোনো মেসেজ না পাঠালে "inactive" ধরা হয়
const INACTIVE_DAYS_THRESHOLD = 30;

// দিনে একবার চলে — দীর্ঘদিন চুপ থাকা মেম্বারদের flag করে (কখনো remove করে না, শুধু
// ড্যাশবোর্ডে দেখানো হয়, admin ম্যানুয়ালি সিদ্ধান্ত নেবে)। নতুন জয়েন করা মেম্বার (created_at
// এখনো থ্রেশহোল্ডের মধ্যে) ভুলভাবে flag না হওয়ার জন্য created_at ও চেক করা হয়। অ্যাডমিনদের
// flag করা হয় না (তারা সাধারণত কম মেসেজ পাঠায় কিন্তু গুরুত্বপূর্ণ সদস্য)
export async function runGroupInactiveMemberFlagTick() {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString();

  const { data: updated, error } = await supabase
    .from("group_members")
    .update({ is_flagged: true, flag_reason: `${INACTIVE_DAYS_THRESHOLD} দিনের বেশি কোনো একটিভিটি নেই` })
    .or(`last_activity_at.is.null,last_activity_at.lt.${cutoff}`)
    .lt("created_at", cutoff)
    .eq("is_flagged", false)
    .eq("is_group_admin", false)
    .select("id");

  if (error) {
    console.error("[group-member-inactivity] tick ব্যর্থ:", error.message);
    return;
  }

  console.log(`[group-member-inactivity] flagged ${updated?.length ?? 0} inactive member(s)`);
}
