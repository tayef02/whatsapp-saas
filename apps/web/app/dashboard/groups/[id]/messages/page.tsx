import { notFound } from "next/navigation";
import { Search, Image as ImageIcon, FileText, Video, Music, Sticker as StickerIcon, Download, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDhakaDateTime } from "@/lib/format-date";

const PAGE_SIZE = 50;
const GROUP_MEDIA_BUCKET = "group-media";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

const mediaIcon: Record<string, React.ElementType> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  sticker: StickerIcon,
};

const mediaLabel: Record<string, string> = {
  image: "ছবি",
  document: "ডকুমেন্ট",
  video: "ভিডিও",
  audio: "অডিও",
  sticker: "স্টিকার",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  received: "neutral",
  sent: "info",
  delivered: "info",
  read: "success",
  failed: "danger",
};

const statusLabel: Record<string, string> = {
  received: "পেয়েছি",
  sent: "পাঠানো হয়েছে",
  delivered: "ডেলিভার্ড",
  read: "পড়া হয়েছে",
  failed: "ব্যর্থ",
};

// PostgREST এর or() ফিল্টার সিনট্যাক্সে কমা/ব্র্যাকেট বিশেষ অর্থ বহন করে, সার্চে থাকলে
// ফিল্টার ভেঙে যেতে পারে — তাই সরিয়ে দেওয়া হচ্ছে (contacts পেজের একই প্যাটার্ন)
function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

export default async function GroupMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id").eq("id", id).maybeSingle();
  if (!group) notFound();

  let query = supabase
    .from("group_messages")
    .select("id, direction, sender_phone, sender_name, content, media_type, media_url, status, created_at", { count: "exact" })
    .eq("group_id", id);

  if (q) {
    const safe = sanitizeSearch(q);
    if (safe) query = query.ilike("content", `%${safe}%`);
  }

  const { data: messages, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // media_url এ শুধু storage path সেভ থাকে (bucket প্রাইভেট) — admin client দিয়ে সাইন করা
  // URL বানানো হয়, গ্রুপ-ownership আগেই উপরের RLS-স্কোপড কোয়েরিতে যাচাই হয়ে গেছে
  const mediaPaths = (messages ?? []).map((m) => m.media_url).filter((p): p is string => Boolean(p));
  const signedUrlByPath = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const admin = createAdminClient();
    const { data: signedUrls } = await admin.storage.from(GROUP_MEDIA_BUCKET).createSignedUrls(mediaPaths, SIGNED_URL_EXPIRY_SECONDS);
    for (const s of signedUrls ?? []) {
      if (s.path && s.signedUrl) signedUrlByPath.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        এই গ্রুপের সব মেসেজ (টেক্সট + মিডিয়া) এখানে সেভ থাকে। মিডিয়া ফাইল ডাউনলোড হতে মেসেজ আসার কিছুক্ষণ পরে সময় লাগতে
        পারে।
      </p>

      <form className="flex gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="মেসেজের টেক্সট দিয়ে খুঁজুন"
            className="w-full rounded-lg border border-border py-2 pr-3 pl-9 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button type="submit" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50">
          খুঁজুন
        </button>
      </form>

      {(!messages || messages.length === 0) && (
        <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="কোনো মেসেজ পাওয়া যায়নি" />
      )}

      <div className="flex flex-col gap-2">
        {messages?.map((m) => {
          const MediaIcon = m.media_type ? mediaIcon[m.media_type] : null;
          const signedUrl = m.media_url ? signedUrlByPath.get(m.media_url) : undefined;
          return (
            <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
              <Card className={`max-w-[85%] sm:max-w-md ${m.direction === "outbound" ? "bg-[#dcf8c6]" : ""}`}>
                <p className="mb-1 text-[11px] text-text-muted">
                  {m.direction === "outbound" ? m.sender_name || "AI" : m.sender_name || m.sender_phone || "(অজানা)"} — {formatDhakaDateTime(m.created_at)}
                  {m.direction === "outbound" && (
                    <Badge variant={statusVariant[m.status] ?? "neutral"} className="ml-1.5">
                      {statusLabel[m.status] ?? m.status}
                    </Badge>
                  )}
                </p>

                {m.media_type && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs text-info">
                    {MediaIcon && <MediaIcon className="h-3.5 w-3.5" />}
                    {mediaLabel[m.media_type] ?? m.media_type}
                    {!m.media_url && <span className="text-text-muted">(ডাউনলোড হচ্ছে...)</span>}
                  </div>
                )}

                {signedUrl &&
                  (m.media_type === "image" || m.media_type === "sticker" ? (
                    <img src={signedUrl} alt={m.content || "media"} className="mb-1.5 max-h-60 max-w-60 rounded-lg" />
                  ) : (
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-1 text-sm text-info hover:underline">
                      <Download className="h-3.5 w-3.5" /> ফাইল ডাউনলোড করুন
                    </a>
                  ))}

                {m.content && <p className="text-sm whitespace-pre-wrap text-text">{m.content}</p>}
              </Card>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/dashboard/groups/${id}/messages?page=${p}${q ? `&q=${q}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${p === page ? "bg-primary text-white" : "bg-gray-100 text-text hover:bg-gray-200"}`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
