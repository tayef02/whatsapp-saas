import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { ShieldAlert } from "lucide-react";
import SkippedCommentsList from "./SkippedCommentsList";

export default async function SkippedCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; reason?: string; status?: string; post?: string }>;
}) {
  const { page: selectedPageIdParam, reason, status, post } = await searchParams;
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
          icon={<ShieldAlert className="h-10 w-10" />}
          title="এখনো কোনো Facebook পেজ কানেক্ট করা হয়নি"
          description="স্কিপড কমেন্ট দেখতে আগে একটা পেজ কানেক্ট করুন।"
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
  const statusFilter = status || "pending_review"; // ডিফল্টে শুধু যেগুলোর পর্যালোচনা বাকি

  let query = supabase
    .from("messenger_comment_skips")
    .select("id, comment_id, post_id, from_psid, comment_text_excerpt, reply_text, action, reason, status, created_at, reviewed_at")
    .eq("messenger_page_id", selectedPageId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (reason) query = query.eq("reason", reason);
  if (post) query = query.eq("post_id", post);

  const { data: skips } = await query;

  // সম্ভব হলে কাস্টমারের নাম — messenger_comments এ আগে থেকেই সেভ আছে, comment_id দিয়ে map
  const commentIds = (skips ?? []).map((s) => s.comment_id);
  const { data: namedComments } =
    commentIds.length > 0
      ? await supabase
          .from("messenger_comments")
          .select("comment_id, from_name")
          .eq("messenger_page_id", selectedPageId)
          .in("comment_id", commentIds)
      : { data: [] };
  const nameByCommentId = new Map((namedComments ?? []).map((c) => [c.comment_id, c.from_name]));

  // পর্যালোচনার অপেক্ষায় কতগুলো আছে (ফিল্টার-নির্বিশেষে, ট্যাবে দেখানোর জন্য)
  const { count: pendingCount } = await supabase
    .from("messenger_comment_skips")
    .select("id", { count: "exact", head: true })
    .eq("messenger_page_id", selectedPageId)
    .eq("status", "pending_review");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">স্কিপ হওয়া কমেন্ট</h1>
        <p className="mt-1 text-xs text-text-muted">
          rate-limit, ডিলিট হওয়া কমেন্ট, বা অন্য কোনো কারণে অটো-রিপ্লাই না যাওয়া কমেন্ট — এখান থেকে ম্যানুয়ালি পাঠাতে বা বাদ দিতে পারবেন।
        </p>
      </div>

      {pages.length > 1 && (
        <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/messenger/comments/skipped?page=${p.id}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                p.id === selectedPageId ? "bg-primary-light text-primary" : "text-text-muted hover:bg-gray-100"
              }`}
            >
              {p.page_name || p.id}
            </Link>
          ))}
        </div>
      )}

      <SkippedCommentsList
        pageId={selectedPageId}
        pendingCount={pendingCount ?? 0}
        currentReason={reason ?? ""}
        currentStatus={statusFilter}
        skips={(skips ?? []).map((s) => ({ ...s, from_name: nameByCommentId.get(s.comment_id) ?? null }))}
      />
    </div>
  );
}
