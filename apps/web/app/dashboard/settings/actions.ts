"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateQuietHours(formData: FormData) {
  const supabase = await createClient();
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  if (!membership) return { error: "workspace পাওয়া যায়নি" };

  const startHour = Number(formData.get("quietStart"));
  const endHour = Number(formData.get("quietEnd"));

  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) return { error: "শুরুর সময় ভুল" };
  if (!Number.isInteger(endHour) || endHour < 0 || endHour > 23) return { error: "শেষের সময় ভুল" };

  const { error } = await supabase
    .from("workspaces")
    .update({ quiet_hours_start_hour: startHour, quiet_hours_end_hour: endHour })
    .eq("id", membership.workspace_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { error: null };
}
