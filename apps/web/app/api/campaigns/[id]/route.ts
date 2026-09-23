import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, status, paused_reason, campaign_stats(total_recipients, sent_count, delivered_count, read_count, failed_count, unknown_count)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "পাওয়া যায়নি" }, { status: 404 });
  }

  return NextResponse.json(data);
}
