"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateSubscription } from "@/lib/subscriptions/activate";

// সার্ভার-সাইডে আবার super admin কিনা যাচাই — শুধু page-এর UI গেটের উপর ভরসা না করে
async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (!isSuperAdmin) throw new Error("অনুমতি নেই");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}

export async function approvePayment(paymentId: string) {
  try {
    const reviewerId = await assertSuperAdmin();
    const admin = createAdminClient();

    const { data: payment } = await admin
      .from("payments")
      .select("workspace_id, plan_id, status")
      .eq("id", paymentId)
      .single();

    if (!payment) return { error: "পেমেন্ট পাওয়া যায়নি" };
    if (payment.status !== "pending") return { error: "এই পেমেন্ট আগেই রিভিউ হয়ে গেছে" };

    await activateSubscription(admin, payment.workspace_id, payment.plan_id);

    await admin
      .from("payments")
      .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq("id", paymentId);

    await admin.from("notifications").insert({
      workspace_id: payment.workspace_id,
      type: "payment_approved",
      title: "আপনার পেমেন্ট অনুমোদিত হয়েছে",
      body: "প্ল্যান চালু হয়ে গেছে।",
    });

    revalidatePath("/dashboard/admin/payments");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে" };
  }
}

export async function rejectPayment(paymentId: string, reason: string) {
  try {
    const reviewerId = await assertSuperAdmin();
    const admin = createAdminClient();

    const { data: payment } = await admin.from("payments").select("workspace_id, status").eq("id", paymentId).single();
    if (!payment) return { error: "পেমেন্ট পাওয়া যায়নি" };
    if (payment.status !== "pending") return { error: "এই পেমেন্ট আগেই রিভিউ হয়ে গেছে" };

    await admin
      .from("payments")
      .update({
        status: "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", paymentId);

    await admin.from("notifications").insert({
      workspace_id: payment.workspace_id,
      type: "payment_rejected",
      title: "আপনার পেমেন্ট বাতিল হয়েছে",
      body: reason || "কারণ জানানো হয়নি — সাপোর্টে যোগাযোগ করুন।",
    });

    revalidatePath("/dashboard/admin/payments");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে" };
  }
}
