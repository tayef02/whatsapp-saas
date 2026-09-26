"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

// প্রথমবার পেজ খুললে config না থাকলে বানিয়ে দেয় (ডিফল্ট: বন্ধ, ইউজার নিজে অন করবে)
export async function ensureChatbotConfig(numberId: string): Promise<{ error: string | null; configId: string | null }> {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি", configId: null };

  const { data: existing } = await supabase
    .from("chatbot_configs")
    .select("id")
    .eq("whatsapp_number_id", numberId)
    .maybeSingle();
  if (existing) return { error: null, configId: existing.id as string };

  const { data: created, error } = await supabase
    .from("chatbot_configs")
    .insert({ whatsapp_number_id: numberId, workspace_id: workspaceId, is_active: false })
    .select("id")
    .single();

  if (error) return { error: error.message, configId: null };
  return { error: null, configId: created.id as string };
}

export async function saveChatbotConfig(configId: string, formData: FormData) {
  const supabase = await createClient();

  const isActive = formData.get("isActive") === "on";
  const welcomeMessage = String(formData.get("welcomeMessage") ?? "").trim() || null;
  const fallbackMessage = String(formData.get("fallbackMessage") ?? "").trim() || null;

  const { error } = await supabase
    .from("chatbot_configs")
    .update({ is_active: isActive, welcome_message: welcomeMessage, fallback_message: fallbackMessage })
    .eq("id", configId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/numbers");
  return { error: null };
}
