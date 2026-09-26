import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusLabel: Record<string, string> = {
  active: "চলমান",
  handed_off: "🔴 এজেন্ট দরকার",
  resolved: "সমাধান হয়েছে",
};

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, contacts(name, phone), whatsapp_numbers(display_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1>Inbox</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Auto-Reply আর কাস্টমারের সব কথোপকথন এখানে দেখা যাবে। 🔴 মানে কোনো rule মেলেনি, এজেন্টের রিপ্লাই দরকার।
      </p>

      {(!conversations || conversations.length === 0) && <p>এখনো কোনো কথোপকথন নেই।</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {conversations?.map((c) => {
          const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
          const number = Array.isArray(c.whatsapp_numbers) ? c.whatsapp_numbers[0] : c.whatsapp_numbers;
          return (
            <Link
              key={c.id}
              href={`/dashboard/inbox/${c.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 14,
                background: "white",
                borderRadius: 8,
                border: c.status === "handed_off" ? "1px solid #fecaca" : "1px solid #eee",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <strong>{contact?.name || contact?.phone || "(অজানা)"}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>{number?.display_name}</div>
              </div>
              <span style={{ alignSelf: "center", fontSize: 12, color: c.status === "handed_off" ? "#dc2626" : "#666" }}>
                {statusLabel[c.status] ?? c.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
