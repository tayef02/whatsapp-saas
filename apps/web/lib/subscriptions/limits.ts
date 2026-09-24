import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// workspace এর বর্তমান প্ল্যান আর সাবস্ক্রিপশন অবস্থা — একসাথে অনেক জায়গায় লাগে
export async function getWorkspacePlanInfo(supabase: Supabase, workspaceId: string) {
  const { data } = await supabase
    .from("workspaces")
    .select(
      "subscription_status, subscription_expires_at, messages_used_this_cycle, plans(monthly_message_limit, contact_limit, max_numbers)"
    )
    .eq("id", workspaceId)
    .single();

  const plan = data?.plans as unknown as
    | { monthly_message_limit: number; contact_limit: number; max_numbers: number }
    | null;

  return {
    subscriptionStatus: data?.subscription_status as string | undefined,
    subscriptionExpiresAt: data?.subscription_expires_at as string | null | undefined,
    messagesUsedThisCycle: data?.messages_used_this_cycle as number | undefined,
    plan,
  };
}

export function isSubscriptionActive(status: string | undefined, expiresAt: string | null | undefined): boolean {
  if (!status || status === "expired") return false;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function getContactCount(supabase: Supabase, workspaceId: string): Promise<number> {
  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  return count ?? 0;
}

export async function getNumberCount(supabase: Supabase, workspaceId: string): Promise<number> {
  const { count } = await supabase
    .from("whatsapp_numbers")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  return count ?? 0;
}
