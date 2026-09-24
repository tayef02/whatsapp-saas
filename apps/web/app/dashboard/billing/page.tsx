import { createClient } from "@/lib/supabase/server";
import BillingForm from "./BillingForm";

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_bdt, monthly_message_limit, contact_limit, max_numbers, duration_days, is_trial")
    .eq("is_active", true)
    .order("price_bdt", { ascending: true });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select(
      "workspace_id, workspaces(subscription_status, subscription_expires_at, messages_used_this_cycle, plans(name, monthly_message_limit))"
    )
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | {
        subscription_status: string;
        subscription_expires_at: string | null;
        messages_used_this_cycle: number;
        plans: { name: string; monthly_message_limit: number } | null;
      }
    | undefined;

  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, amount_bdt, transaction_id, status, rejection_reason, created_at, plans(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <BillingForm
      plans={plans ?? []}
      currentSubscription={workspace ?? null}
      payments={payments ?? []}
      bkashNumber={process.env.BKASH_RECEIVE_NUMBER ?? ""}
      nagadNumber={process.env.NAGAD_RECEIVE_NUMBER ?? ""}
    />
  );
}
