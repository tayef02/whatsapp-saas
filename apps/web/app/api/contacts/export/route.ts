import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// RLS-স্কোপড ক্লায়েন্ট দিয়ে, তাই ইউজার শুধু নিজের workspace এর কন্টাক্ট এক্সপোর্ট করতে পারবে
export async function GET() {
  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("phone, name, tags, opted_out, custom_fields, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = "phone,name,tags,opted_out,custom_fields,created_at";
  const lines = (contacts ?? []).map((c) =>
    [
      c.phone,
      c.name ?? "",
      (c.tags ?? []).join("|"),
      c.opted_out ? "true" : "false",
      JSON.stringify(c.custom_fields ?? {}),
      c.created_at,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts.csv"`,
    },
  });
}
