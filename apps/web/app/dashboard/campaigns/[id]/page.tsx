import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignReport from "./CampaignReport";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select(
      "id, status, paused_reason, whatsapp_number_id, campaign_stats(total_recipients, sent_count, delivered_count, read_count, failed_count, unknown_count)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const { data: failedMessages } = await supabase
    .from("messages")
    .select("id, phone, failed_reason, retry_count, contacts(name)")
    .eq("campaign_id", id)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(100);

  const stallNote = data.status === "sending" ? await getStallNote(supabase, id, data.whatsapp_number_id) : null;

  return <CampaignReport initial={{ ...data, failedMessages: failedMessages ?? [] }} stallNote={stallNote} />;
}

// "পাঠানো হচ্ছে" স্ট্যাটাসে অনেকক্ষণ পড়ে থাকলে ইউজার বুঝতে পারে না এটা আসল সমস্যা নাকি
// স্বাভাবিক সেফটি লিমিট (নাম্বার অফলাইন / ওয়ার্মআপ-দৈনিক ক্যাপ) — schedule_number_messages()
// এর মতোই হিসাব করে একটা সংক্ষিপ্ত কারণ দেখানো হয় (এটা শুধু তথ্যের জন্য, scheduler এর
// আসল সিদ্ধান্ত এখনো DB ফাংশনেই হয়)
async function getStallNote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  numberId: string | null
) {
  if (!numberId) return null;

  const { count: pendingCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (!pendingCount) return null;

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("status, connected_at, daily_message_limit")
    .eq("id", numberId)
    .maybeSingle();
  if (!number) return null;

  if (number.status !== "online") {
    return "নাম্বারটা এখন অনলাইন না — অনলাইন হলে বাকি মেসেজ আবার পাঠানো শুরু হবে।";
  }

  const connectedDays = number.connected_at ? (Date.now() - new Date(number.connected_at).getTime()) / 86400000 : 0;
  const warmupCap =
    connectedDays < 2 ? 20 : connectedDays < 4 ? 50 : connectedDays < 7 ? 100 : connectedDays < 14 ? 150 : Infinity;
  const effectiveLimit = Math.min(number.daily_message_limit, warmupCap);

  const dhakaTodayStart = new Date(new Date().setUTCHours(0, 0, 0, 0) - 6 * 3600000).toISOString();
  const { count: sentToday } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_number_id", numberId)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", dhakaTodayStart);
  const { count: scheduledPending } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_number_id", numberId)
    .eq("status", "scheduled");

  if ((sentToday ?? 0) + (scheduledPending ?? 0) >= effectiveLimit) {
    return `আজকের জন্য এই নাম্বারের পাঠানোর সীমা (${effectiveLimit}টা${connectedDays < 14 ? ", ওয়ার্মআপ চলছে" : ""}) শেষ হয়ে গেছে — কাল আবার চলবে।`;
  }

  return null;
}
