import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignReport from "./CampaignReport";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select("id, status, paused_reason, campaign_stats(total_recipients, sent_count, delivered_count, read_count, failed_count, unknown_count)")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return <CampaignReport initial={data} />;
}
