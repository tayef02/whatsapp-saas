"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function pauseCampaign(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "paused", paused_reason: "manual" })
    .eq("id", id)
    .eq("status", "sending");
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/campaigns/${id}`);
  return { error: null };
}

export async function resumeCampaign(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "sending", paused_reason: null })
    .eq("id", id)
    .eq("status", "paused");
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/campaigns/${id}`);
  return { error: null };
}

export async function cancelCampaign(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "sending", "paused"]);
  if (error) return { error: error.message };

  await supabase.from("messages").update({ status: "cancelled" }).eq("campaign_id", id).in("status", ["pending", "scheduled"]);

  revalidatePath(`/dashboard/campaigns/${id}`);
  return { error: null };
}

export async function retryFailedMessages(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ status: "pending", retry_count: 0, failed_reason: null })
    .eq("campaign_id", id)
    .eq("status", "failed");
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/campaigns/${id}`);
  return { error: null };
}
