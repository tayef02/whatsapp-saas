"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "");
  const numberId = String(formData.get("numberId") ?? "");
  const audienceTag = String(formData.get("audienceTag") ?? "").trim() || null;
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const minDelay = Number(formData.get("minDelay"));
  const maxDelay = Number(formData.get("maxDelay"));

  if (!name) return { error: "ক্যাম্পেইনের নাম দিন" };
  if (!templateId) return { error: "টেমপ্লেট বাছাই করুন" };
  if (!numberId) return { error: "নাম্বার বাছাই করুন" };

  if (Number.isInteger(minDelay) && Number.isInteger(maxDelay) && minDelay > 0 && maxDelay >= minDelay) {
    // ডিলে নাম্বার-ভিত্তিক (ক্যাম্পেইন-ভিত্তিক না) — তাই এখানে বদলালে এই নাম্বারের
    // সব ক্যাম্পেইনেই প্রযোজ্য হবে
    await supabase
      .from("whatsapp_numbers")
      .update({ min_delay_seconds: minDelay, max_delay_seconds: maxDelay })
      .eq("id", numberId);
  }

  // মডিউল ৭ এ এখানে workspace এর monthly_message_limit এর সাথে audience সংখ্যা
  // মিলিয়ে চেক করা হবে (এখন limit সেট করা নেই, তাই এই ধাপ স্কিপ)

  let query = supabase.from("contacts").select("id, phone", { count: "exact" }).eq("opted_out", false);
  if (audienceTag) query = query.contains("tags", [audienceTag]);
  const { data: contacts, count } = await query;

  if (!contacts || contacts.length === 0) {
    return { error: "এই অডিয়েন্সে কোনো কন্টাক্ট নেই" };
  }

  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;
  const isScheduledForLater = scheduledAt && new Date(scheduledAt).getTime() > Date.now();

  const admin = createAdminClient();

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      template_id: templateId,
      whatsapp_number_id: numberId,
      name,
      audience_tag: audienceTag,
      status: isScheduledForLater ? "scheduled" : "sending",
      scheduled_at: scheduledAt,
      started_at: isScheduledForLater ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (campaignError || !campaign) return { error: campaignError?.message ?? "ক্যাম্পেইন বানানো যায়নি" };

  await admin.from("campaign_stats").insert({ campaign_id: campaign.id, total_recipients: count ?? contacts.length });

  const BATCH_SIZE = 1000;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE).map((c) => ({
      workspace_id: workspaceId,
      campaign_id: campaign.id,
      contact_id: c.id,
      whatsapp_number_id: numberId,
      phone: c.phone,
    }));
    await admin.from("messages").insert(batch);
  }

  return { error: null, id: campaign.id as string };
}

// অডিয়েন্স বক্সে ট্যাগ লেখার সাথে সাথে কতজন পাবে দেখানোর জন্য (opt-out বাদে)
export async function getAudienceCount(tag: string | null): Promise<number> {
  const supabase = await createClient();

  let query = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("opted_out", false);
  if (tag) query = query.contains("tags", [tag]);

  const { count } = await query;
  return count ?? 0;
}
