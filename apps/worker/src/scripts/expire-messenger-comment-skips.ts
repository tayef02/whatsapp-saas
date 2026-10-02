// দিনে একবার (external cron দিয়ে) চালানোর স্ক্রিপ্ট — দুটো কাজ করে:
// ১. ৭ দিনের পুরনো pending private-reply-ইচ্ছুক skip রো গুলো reason="expired_7d" মার্ক করে
//    (Meta এর ৭ দিনের মেসেজিং উইন্ডোর সাথে সামঞ্জস্যপূর্ণ — এর পরে আর ম্যানুয়ালি প্রাইভেট
//    রিপ্লাই পাঠানো সম্ভব না, UI এটা দেখেই পাবলিক রিপ্লাই এর পরামর্শ দেয়)।
// ২. প্রতিটা workspace এ pending_review থাকলে একটা সারাংশ নোটিফিকেশন ("দিনে সর্বোচ্চ একটা"
//    — এই স্ক্রিপ্ট দিনে একবারই চলার কথা বলে আলাদা করে dedup-চেক লাগে না, cron schedule
//    নিজেই এটা নিশ্চিত করে)।
//
// চালানোর নিয়ম: docker exec wa-worker npm run expire-comment-skips (VPS crontab এ দিনে
// একবার, যেমন রাত ৩টায়) — docs/messenger-plan.md এর M3 টেস্ট সেকশনে বিস্তারিত।

import { getSupabase } from "../lib/supabase";
import { createNotification } from "../lib/notify";
import { MESSENGER_COMMENT_LIMITS } from "@whatsapp-saas/core/messenger/comment-limits";

async function main() {
  const supabase = getSupabase();
  const cutoffIso = new Date(Date.now() - MESSENGER_COMMENT_LIMITS.SKIP_REVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: expireError } = await supabase
    .from("messenger_comment_skips")
    .update({ reason: "expired_7d" })
    .eq("status", "pending_review")
    .eq("action", "private_reply")
    .lt("created_at", cutoffIso)
    .neq("reason", "expired_7d")
    .select("id");

  if (expireError) {
    console.error(`[expire-messenger-comment-skips] expire আপডেট ব্যর্থ: ${expireError.message}`);
  } else {
    console.log(`[expire-messenger-comment-skips] ${expired?.length ?? 0}টা পুরনো private-reply skip "expired_7d" মার্ক হলো`);
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("messenger_comment_skips")
    .select("workspace_id")
    .eq("status", "pending_review");

  if (pendingError) {
    console.error(`[expire-messenger-comment-skips] pending গণনা ব্যর্থ: ${pendingError.message}`);
    return;
  }

  const countByWorkspace = new Map<string, number>();
  for (const row of pendingRows ?? []) {
    countByWorkspace.set(row.workspace_id, (countByWorkspace.get(row.workspace_id) ?? 0) + 1);
  }

  for (const [workspaceId, count] of countByWorkspace) {
    await createNotification(
      workspaceId,
      "messenger_comment_skip_summary",
      "স্কিপ হওয়া কমেন্ট পর্যালোচনার অপেক্ষায়",
      "messenger",
      `${count}টা কমেন্ট rate-limit/অন্য কারণে অটো-রিপ্লাই পায়নি — "কমেন্ট অটোমেশন"-এর "স্কিপড কমেন্ট দেখুন" থেকে দেখুন।`
    );
  }

  console.log(`[expire-messenger-comment-skips] ${countByWorkspace.size}টা workspace কে সারাংশ নোটিফিকেশন পাঠানো হলো`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[expire-messenger-comment-skips] ব্যর্থ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
