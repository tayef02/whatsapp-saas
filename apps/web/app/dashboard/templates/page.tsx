import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, category, content, media_type")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>টেমপ্লেট</h1>
        <Link
          href="/dashboard/templates/new"
          style={{ background: "#16a34a", color: "white", padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}
        >
          + নতুন টেমপ্লেট
        </Link>
      </div>

      {(!templates || templates.length === 0) && <p>এখনো কোনো টেমপ্লেট নেই।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates?.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/templates/${t.id}`}
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
              <strong>{t.name}</strong>
              {t.category && <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>({t.category})</span>}
              <div style={{ fontSize: 13, color: "#666", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.content}
              </div>
            </div>
            {t.media_type && (
              <span style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>
                {t.media_type === "image" ? "📷 ছবি" : "📄 PDF"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
