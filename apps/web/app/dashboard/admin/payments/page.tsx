import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PendingPaymentsList from "./PendingPaymentsList";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  if (!isSuperAdmin) {
    notFound();
  }

  // এখান থেকে service_role — super admin কে সব workspace এর পেমেন্ট দেখতে হবে,
  // যেগুলোর সে সদস্য না, তাই RLS-স্কোপড ক্লায়েন্ট দিয়ে সম্ভব না
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select("id, amount_bdt, provider, sender_phone, transaction_id, created_at, workspaces(name), plans(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <PendingPaymentsList payments={payments ?? []} />;
}
