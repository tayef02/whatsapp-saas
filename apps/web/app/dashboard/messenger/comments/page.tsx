import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { MessageSquare } from "lucide-react";
import CommentRulesList from "./CommentRulesList";
import CommentLogTable from "./CommentLogTable";

const COMMENT_LOG_PAGE_SIZE = 20;

// "page" query param FB পেজ (messenger_pages.id, UUID) বাছতে আগে থেকেই ব্যবহার হয় — তাই কমেন্ট
// লগের পেজিনেশনের জন্য আলাদা নাম "logPage", যাতে দুটো মিশে না যায়
export default async function MessengerCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; logPage?: string }>;
}) {
  const { page: selectedPageIdParam, logPage: logPageParam } = await searchParams;
  const logPage = Math.max(1, Number(logPageParam) || 1);
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("messenger_pages")
    .select("id, page_name")
    .eq("status", "active")
    .order("connected_at", { ascending: true });

  if (!pages || pages.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="এখনো কোনো Facebook পেজ কানেক্ট করা হয়নি"
          description="কমেন্ট অটোমেশন সেটআপ করতে আগে একটা পেজ কানেক্ট করুন।"
          action={
            <Link
              href="/dashboard/messenger"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              পেজ কানেক্ট করুন
            </Link>
          }
        />
      </Card>
    );
  }

  const selectedPageId = pages.find((p) => p.id === selectedPageIdParam)?.id ?? pages[0].id;

  const { data: rules } = await supabase
    .from("messenger_comment_rules")
    .select("id, trigger_type, keyword, action, reply_mode, reply_text, cooldown_seconds, is_active, last_triggered_at")
    .eq("messenger_page_id", selectedPageId)
    .order("created_at", { ascending: false });

  const { data: comments, count: commentCount } = await supabase
    .from("messenger_comments")
    .select(
      "id, comment_id, from_name, comment_text, reply_text, is_lead, lead_phone, is_own_comment, action, replied_at, queued_at, reply_scheduled_at, created_at",
      { count: "exact" }
    )
    .eq("messenger_page_id", selectedPageId)
    .order("created_at", { ascending: false })
    .range((logPage - 1) * COMMENT_LOG_PAGE_SIZE, logPage * COMMENT_LOG_PAGE_SIZE - 1);

  const commentLogTotalPages = Math.max(1, Math.ceil((commentCount ?? 0) / COMMENT_LOG_PAGE_SIZE));

  // উপরের ৫০টা কমেন্টের মধ্যে যেগুলো স্কিপ হয়েছে, সেগুলোর কারণ/স্ট্যাটাস একসাথে এনে map বানানো —
  // প্রতিটা রো এর জন্য আলাদা কোয়েরি না করে একটাই কোয়েরিতে (N+1 এড়াতে)
  const commentIds = (comments ?? []).map((c) => c.comment_id);
  const { data: skips } =
    commentIds.length > 0
      ? await supabase
          .from("messenger_comment_skips")
          .select("comment_id, reason, status")
          .eq("messenger_page_id", selectedPageId)
          .in("comment_id", commentIds)
      : { data: [] };
  const skipByCommentId = new Map((skips ?? []).map((s) => [s.comment_id, s]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">কমেন্ট অটোমেশন</h1>
          <p className="mt-1 text-xs text-text-muted">পোস্টের কমেন্টে কিওয়ার্ড/AI দিয়ে অটো-রিপ্লাই, বা Private Reply দিয়ে ইনবক্সে নিয়ে আসা।</p>
        </div>
        <Link
          href="/dashboard/messenger/comments/skipped"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-gray-50"
        >
          স্কিপড কমেন্ট দেখুন
        </Link>
      </div>

      {pages.length > 1 && (
        <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/messenger/comments?page=${p.id}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                p.id === selectedPageId ? "bg-primary-light text-primary" : "text-text-muted hover:bg-gray-100"
              }`}
            >
              {p.page_name || p.id}
            </Link>
          ))}
        </div>
      )}

      <CommentRulesList pageId={selectedPageId} rules={rules ?? []} />
      <CommentLogTable
        comments={(comments ?? []).map((c) => ({ ...c, skip: skipByCommentId.get(c.comment_id) ?? null }))}
        selectedPageId={selectedPageId}
        logPage={logPage}
        totalPages={commentLogTotalPages}
      />
    </div>
  );
}
