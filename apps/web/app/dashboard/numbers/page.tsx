import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusLabel: Record<string, string> = {
  connecting: "কানেক্ট হচ্ছে...",
  online: "অনলাইন",
  offline: "অফলাইন",
  banned: "ব্যান হয়েছে",
};

export default async function NumbersPage() {
  const supabase = await createClient();

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name, phone_number, status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>WhatsApp নাম্বার</h1>
        <Link
          href="/dashboard/numbers/new"
          style={{ background: "#16a34a", color: "white", padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}
        >
          + নতুন নাম্বার যোগ করুন
        </Link>
      </div>

      {(!numbers || numbers.length === 0) && <p>এখনো কোনো নাম্বার যোগ করা হয়নি।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {numbers?.map((n) => (
          <Link
            key={n.id}
            href={`/dashboard/numbers/${n.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 16,
              background: "white",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #eee",
            }}
          >
            <div>
              <strong>{n.display_name}</strong>
              <div style={{ fontSize: 13, color: "#666" }}>{n.phone_number ?? "নাম্বার এখনো কানেক্ট হয়নি"}</div>
            </div>
            <span
              style={{
                alignSelf: "center",
                fontSize: 13,
                padding: "4px 10px",
                borderRadius: 999,
                background: n.status === "online" ? "#dcfce7" : "#f3f4f6",
                color: n.status === "online" ? "#166534" : "#555",
              }}
            >
              {statusLabel[n.status] ?? n.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
