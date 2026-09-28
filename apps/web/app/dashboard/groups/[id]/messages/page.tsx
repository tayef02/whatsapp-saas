import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDhakaDateTime } from "@/lib/format-date";

const PAGE_SIZE = 50;
const GROUP_MEDIA_BUCKET = "group-media";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

const mediaLabel: Record<string, string> = {
  image: "🖼️ ছবি",
  document: "📄 ডকুমেন্ট",
  video: "🎥 ভিডিও",
  audio: "🎧 অডিও",
  sticker: "🎨 স্টিকার",
};

const statusLabel: Record<string, string> = {
  received: "পেয়েছি",
  sent: "পাঠানো হয়েছে",
  delivered: "✓✓ ডেলিভার্ড",
  read: "✓✓ পড়া হয়েছে",
  failed: "❌ ব্যর্থ",
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

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", id).maybeSingle();
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
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard/groups">← গ্রুপ লিস্টে ফিরুন</Link>
      </p>
      <h1>মেসেজ আর্কাইভ — {group.name || "(নাম নেই)"} ({count ?? 0})</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        এই গ্রুপের সব মেসেজ (টেক্সট + মিডিয়া) এখানে সেভ থাকে। মিডিয়া ফাইল ডাউনলোড হতে মেসেজ আসার কিছুক্ষণ পরে সময় লাগতে
        পারে — এর মধ্যে দেখলে শুধু টাইপ/ক্যাপশন দেখাবে, লিংক এখনো প্রস্তুত হয়নি বুঝবেন।
      </p>

      <form style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="মেসেজের টেক্সট দিয়ে খুঁজুন" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", flex: 1 }} />
        <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, background: "#eee", border: "none", cursor: "pointer" }}>
          খুঁজুন
        </button>
      </form>

      {(!messages || messages.length === 0) && <p>কোনো মেসেজ পাওয়া যায়নি।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {messages?.map((m) => (
          <div
            key={m.id}
            style={{
              padding: 12,
              background: "white",
              borderRadius: 8,
              border: "1px solid #eee",
              fontSize: 13,
              alignSelf: m.direction === "outbound" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{ color: "#666", fontSize: 11, marginBottom: 4 }}>
              {m.direction === "outbound" ? m.sender_name || "AI" : m.sender_name || m.sender_phone || "(অজানা)"} —{" "}
              {formatDhakaDateTime(m.created_at)}
              {m.direction === "outbound" && statusLabel[m.status] && ` — ${statusLabel[m.status]}`}
            </div>
            {m.media_type && (
              <div style={{ color: "#2563eb", marginBottom: 4 }}>
                {mediaLabel[m.media_type] ?? m.media_type}
                {!m.media_url && <span style={{ color: "#999", marginLeft: 6, fontSize: 11 }}>(ডাউনলোড হচ্ছে...)</span>}
              </div>
            )}
            {m.media_url &&
              signedUrlByPath.get(m.media_url) &&
              (m.media_type === "image" || m.media_type === "sticker" ? (
                <img
                  src={signedUrlByPath.get(m.media_url)}
                  alt={m.content || "media"}
                  style={{ maxWidth: 240, maxHeight: 240, borderRadius: 6, marginBottom: 4, display: "block" }}
                />
              ) : (
                <a href={signedUrlByPath.get(m.media_url)} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 4, color: "#2563eb" }}>
                  ফাইল ডাউনলোড করুন →
                </a>
              ))}
            {m.content && <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dashboard/groups/${id}/messages?page=${p}${q ? `&q=${q}` : ""}`}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: p === page ? "#16a34a" : "#eee",
                color: p === page ? "white" : "inherit",
                textDecoration: "none",
              }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
