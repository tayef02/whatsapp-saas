import type { SupabaseClient } from "@supabase/supabase-js";

// Messenger কমেন্ট অটোমেশনে rate-limit/অন্য কোনো কারণে রিপ্লাই না যাওয়া কমেন্টের জন্য একটা
// রিভিউ-যোগ্য রো লেখে (messenger_comment_skips) — CLAUDE.md এর নিয়ম: "কোনো অটোমেশন কিছু
// স্কিপ করলে অবশ্যই পর্যালোচনার তালিকায় রো থাকবে"। লেখা ব্যর্থ হলেও (non-critical) শুধু
// লগ — কমেন্ট প্রসেসিং আটকায় না, caller কখনো এই ফাংশনের জন্য throw পাবে না।
//
// কমেন্টের লেখা কখনো console এ যায় না — শুধু excerpt DB কলামে (workspace RLS দিয়ে সুরক্ষিত)।
const EXCERPT_MAX_LENGTH = 200;

export type CommentSkipReason =
  | "cooldown_active"
  | "limit_per_customer"
  | "limit_per_page"
  | "rule_not_matched"
  | "private_limit"
  | "comment_deleted"
  | "expired_7d"
  | "bot_disabled"
  | "reply_failed"
  | "queue_expired";

export async function writeMessengerCommentSkip(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    messengerPageId: string;
    commentId: string;
    postId: string | null;
    fromPsid: string | null;
    commentText?: string;
    matchedRuleId?: string | null;
    action?: "public_reply" | "private_reply" | null;
    // রুল ম্যাচ করে ইতিমধ্যে জেনারেট হওয়া রিপ্লাই টেক্সট (rate-limit এ আটকানোর আগ পর্যন্ত) —
    // থাকলে "স্কিপড কমেন্ট" পেজে "এখন পাঠান" ফর্মে প্রি-ফিল হবে
    replyText?: string | null;
    reason: CommentSkipReason;
  }
): Promise<void> {
  const excerpt = params.commentText ? params.commentText.slice(0, EXCERPT_MAX_LENGTH) : null;

  const { error } = await supabase.from("messenger_comment_skips").insert({
    workspace_id: params.workspaceId,
    messenger_page_id: params.messengerPageId,
    comment_id: params.commentId,
    post_id: params.postId,
    from_psid: params.fromPsid,
    comment_text_excerpt: excerpt,
    matched_rule_id: params.matchedRuleId ?? null,
    action: params.action ?? null,
    reply_text: params.replyText ?? null,
    reason: params.reason,
  });

  if (error) {
    console.error(
      `[messenger-comment-skip] skip row লেখা ব্যর্থ (non-critical) reason=${params.reason} commentId=${params.commentId}: ${error.message}`
    );
  }
}
