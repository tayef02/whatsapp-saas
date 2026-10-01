"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAutoReplyQueue } from "@/lib/queue/autoreply-queue";
import { getMessengerJobsQueue } from "@/lib/queue/messenger-jobs-queue";
import type { AutoReplyJobData, DirectMessageJobData } from "@whatsapp-saas/core/chatbot/types";
import type { MessengerReplyJobData } from "@whatsapp-saas/core/messenger/types";

type OrderStatus = "pending" | "confirmed" | "shipped" | "cancelled";

// Meta এর POST_PURCHASE_UPDATE ট্যাগ ২০২৬-০২-১০ থেকে বন্ধ হয়ে যাচ্ছে — তাই অর্ডার-স্ট্যাটাস
// মেসেজে কোনো ট্যাগ ব্যবহার করা হচ্ছে না, শুধু standard ২৪ ঘণ্টার উইন্ডো। (ইনবক্সের ম্যানুয়াল
// এজেন্ট রিপ্লাইয়ে HUMAN_AGENT ট্যাগ আলাদাভাবে সাপোর্টেড — সেটা প্রোমোশনাল/নোটিফিকেশন কনটেন্ট না)
const MESSENGER_WINDOW_HOURS = 24;

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
    .select("id, workspace_id, conversation_id, whatsapp_number_id, channel, messenger_page_id, contact_phone, product_name, order_number, status")
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
  } else if (order.channel === "messenger") {
    if (!order.messenger_page_id || !order.contact_phone) {
      warning = "স্ট্যাটাস আপডেট হয়েছে, কিন্তু কাস্টমারকে মেসেজ পাঠানো যায়নি (Messenger পেজ/কাস্টমার খুঁজে পাওয়া যায়নি)।";
    } else {
      // orders.contact_phone এ Messenger এর জন্য psid থাকে (আলাদা কলাম ছাড়াই reuse) —
      // messenger_conversations এ (messenger_page_id, psid) দিয়ে খুঁজে window/conversationId বের করা হয়
      const { data: conversation } = await supabase
        .from("messenger_conversations")
        .select("id, last_user_message_at")
        .eq("messenger_page_id", order.messenger_page_id)
        .eq("psid", order.contact_phone)
        .maybeSingle();

      const hoursSinceLastUserMessage = conversation?.last_user_message_at
        ? (Date.now() - new Date(conversation.last_user_message_at).getTime()) / 3_600_000
        : Infinity;

      if (!conversation || hoursSinceLastUserMessage >= MESSENGER_WINDOW_HOURS) {
        // POST_PURCHASE_UPDATE ট্যাগ ২০২৬-০২-১০ থেকে বন্ধ হয়ে যাচ্ছে বলে এখানে কোনো ট্যাগ দিয়ে
        // escalate করা হচ্ছে না — উইন্ডো শেষ মানে এই মেসেজ পাঠানোই যাবে না, স্পষ্ট জানিয়ে দেওয়া হচ্ছে
        warning = "বার্তা পাঠানো যায়নি: উইন্ডো শেষ (Messenger এর ২৪ ঘণ্টার মেসেজিং উইন্ডো পার হয়ে গেছে)।";
      } else {
        const jobData: MessengerReplyJobData = {
          conversationId: conversation.id,
          messengerPageId: order.messenger_page_id,
          psid: order.contact_phone,
          replyText: statusMessage[status](order.order_number, order.product_name, reason),
          senderType: "bot",
          allowHumanAgentTag: false,
          markHandedOff: false,
        };
        await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
      }
    }
  } else if (order.conversation_id && order.whatsapp_number_id) {
    // ১:১ চ্যাট থেকে আসা অর্ডার — conversation_messages এ লগসহ পাঠানো হয়
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
  } else if (order.whatsapp_number_id && order.contact_phone) {
    // গ্রুপ থেকে regex দিয়ে ক্যাপচার করা অর্ডার — কখনো বটের সাথে ১:১ চ্যাট হয়নি, তাই কোনো
    // conversation নেই। সরাসরি কাস্টমারের ফোন নাম্বারে পাঠানো হয় (group_id থাকলেও গ্রুপে না,
    // কাস্টমারকে ব্যক্তিগতভাবে জানানোই বেশি প্রাসঙ্গিক)
    const directJobData: DirectMessageJobData = {
      whatsappNumberId: order.whatsapp_number_id,
      phone: order.contact_phone,
      replyText: statusMessage[status](order.order_number, order.product_name, reason),
    };
    await getAutoReplyQueue().add("direct-message", directJobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  } else {
    warning = "স্ট্যাটাস আপডেট হয়েছে, কিন্তু কাস্টমারকে মেসেজ পাঠানো যায়নি (নাম্বার খুঁজে পাওয়া যায়নি)।";
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
