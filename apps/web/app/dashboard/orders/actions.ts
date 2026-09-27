"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAutoReplyQueue } from "@/lib/queue/autoreply-queue";
import type { AutoReplyJobData } from "@whatsapp-saas/core/chatbot/types";

type OrderStatus = "pending" | "confirmed" | "shipped" | "cancelled";

// pending এ ফেরত যাওয়ার জন্য কোনো মেসেজ টেমপ্লেট নেই — সেটা initial state, admin ভুলে
// আবার pending করলে কাস্টমারকে বিভ্রান্তিকর মেসেজ পাঠানোর দরকার নেই
const statusMessage: Record<Exclude<OrderStatus, "pending">, (orderNumber: number, productName: string | null, reason?: string) => string> = {
  confirmed: (n, p) => `আপনার অর্ডার #${n}${p ? ` (${p})` : ""} কনফার্ম করা হয়েছে।`,
  shipped: (n, p) => `আপনার অর্ডার #${n}${p ? ` (${p})` : ""} পাঠানো হয়েছে! শীঘ্রই পৌঁছে যাবে।`,
  cancelled: (n, p, reason) => `দুঃখিত, আপনার অর্ডার #${n}${p ? ` (${p})` : ""} বাতিল করা হয়েছে।${reason ? ` কারণ: ${reason}।` : ""}`,
};

// Orders পেজ থেকে status বদলালে: DB আপডেট + history log + (সম্ভব হলে) কাস্টমারকে
// automatic WhatsApp আপডেট মেসেজ — মেসেজ পাঠানো queue দিয়েই যায়, Next.js থেকে সরাসরি
// Evolution কল না (প্রজেক্টের আর্কিটেকচার নিয়ম অনুযায়ী)
export async function updateOrderStatus(orderId: string, status: OrderStatus, reason?: string) {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, workspace_id, conversation_id, whatsapp_number_id, contact_phone, product_name, order_number, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "অর্ডার পাওয়া যায়নি" };

  const { error } = await supabase
    .from("orders")
    .update({ status, ...(status === "cancelled" ? { cancel_reason: reason ?? null } : {}) })
    .eq("id", orderId);

  if (error) return { error: error.message };

  await supabase.from("order_status_history").insert({
    order_id: order.id,
    workspace_id: order.workspace_id,
    from_status: order.status,
    to_status: status,
    reason: status === "cancelled" ? reason ?? null : null,
  });

  let warning: string | null = null;
  if (status === "pending") {
    // কোনো মেসেজ পাঠানো হয় না
  } else if (!order.conversation_id || !order.whatsapp_number_id) {
    warning = "স্ট্যাটাস আপডেট হয়েছে, কিন্তু কাস্টমারকে মেসেজ পাঠানো যায়নি (কথোপকথন/নাম্বার খুঁজে পাওয়া যায়নি)।";
  } else {
    const jobData: AutoReplyJobData = {
      conversationId: order.conversation_id,
      workspaceId: order.workspace_id,
      whatsappNumberId: order.whatsapp_number_id,
      phone: order.contact_phone,
      replyText: statusMessage[status](order.order_number, order.product_name, reason),
      markHandedOff: false,
      senderType: "bot",
    };
    await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  }

  revalidatePath("/dashboard/orders");
  return { error: null, warning };
}

export async function getOrderHistory(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_status_history")
    .select("from_status, to_status, reason, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
