"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

export async function submitPayment(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const planId = String(formData.get("planId") ?? "");
  const provider = String(formData.get("provider") ?? "");
  const senderPhone = String(formData.get("senderPhone") ?? "").trim();
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const amountBdt = Number(formData.get("amountBdt"));

  if (!planId) return { error: "প্ল্যান বাছাই করুন" };
  if (provider !== "bkash" && provider !== "nagad") return { error: "পেমেন্ট মাধ্যম বাছাই করুন" };
  if (!senderPhone) return { error: "যে নাম্বার থেকে পাঠিয়েছেন সেটা দিন" };
  if (!transactionId) return { error: "Transaction ID দিন" };

  const { error } = await supabase.from("payments").insert({
    workspace_id: workspaceId,
    plan_id: planId,
    amount_bdt: amountBdt,
    provider,
    sender_phone: senderPhone,
    transaction_id: transactionId,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") return { error: "এই Transaction ID আগেই জমা দেওয়া হয়েছে" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/billing");
  return { error: null };
}
