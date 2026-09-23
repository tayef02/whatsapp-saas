import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// বড় ফাইল ইম্পোর্টের প্রগ্রেস পোলিং এর জন্য — RLS-স্কোপড ক্লায়েন্ট, তাই ইউজার
// শুধু নিজের workspace এর import স্ট্যাটাস দেখতে পারবে
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_imports")
    .select("id, status, total_rows, processed_rows, added_count, duplicate_count, invalid_count, error_message")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "পাওয়া যায়নি" }, { status: 404 });
  }

  return NextResponse.json(data);
}
