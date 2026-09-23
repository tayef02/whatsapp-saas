import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

// PostgREST এর or() ফিল্টার সিনট্যাক্সে কমা/ব্র্যাকেট বিশেষ অর্থ বহন করে,
// সার্চ ইনপুটে থাকলে ফিল্টার ভেঙে যেতে পারে — তাই সরিয়ে দেওয়া হচ্ছে
function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>;
}) {
  const { page: pageParam, q, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, phone, name, tags, opted_out, created_at", { count: "exact" });

  if (q) {
    const safe = sanitizeSearch(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: contacts, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>কন্টাক্ট ({count ?? 0})</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/api/contacts/export" style={linkButtonStyle}>
            CSV এক্সপোর্ট
          </a>
          <Link href="/dashboard/contacts/import" style={linkButtonStyle}>
            ইম্পোর্ট
          </Link>
          <Link href="/dashboard/contacts/new" style={{ ...linkButtonStyle, background: "#16a34a", color: "white" }}>
            + যোগ করুন
          </Link>
        </div>
      </div>

      <form style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="নাম বা নাম্বার দিয়ে খুঁজুন" style={inputStyle} />
        <input name="tag" defaultValue={tag ?? ""} placeholder="ট্যাগ দিয়ে ফিল্টার" style={inputStyle} />
        <button type="submit" style={linkButtonStyle}>
          খুঁজুন
        </button>
      </form>

      {(!contacts || contacts.length === 0) && <p>কোনো কন্টাক্ট পাওয়া যায়নি।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {contacts?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/contacts/${c.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 14,
              background: "white",
              borderRadius: 8,
              border: "1px solid #eee",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <strong>{c.name || "(নাম নেই)"}</strong>
              <div style={{ fontSize: 13, color: "#666" }}>
                {c.phone} {c.tags?.length > 0 && `· ${c.tags.join(", ")}`}
              </div>
            </div>
            {c.opted_out && (
              <span style={{ alignSelf: "center", fontSize: 12, color: "#dc2626" }}>opt-out</span>
            )}
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dashboard/contacts?page=${p}${q ? `&q=${q}` : ""}${tag ? `&tag=${tag}` : ""}`}
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

const linkButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  background: "#eee",
  textDecoration: "none",
  color: "inherit",
  border: "none",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
};
