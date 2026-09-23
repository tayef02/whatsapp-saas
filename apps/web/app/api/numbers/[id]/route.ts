import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// QR/status পোলিং এর জন্য — RLS-স্কোপড ক্লায়েন্ট ব্যবহার করে, তাই ইউজার
// শুধু নিজের workspace এর নাম্বারের স্ট্যাটাস দেখতে পাবে
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_numbers")
    .select("id, status, qr_code, phone_number, display_name")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "পাওয়া যায়নি" }, { status: 404 });
  }

  return NextResponse.json(data);
}
