import { createClient } from "@/lib/supabase/server";
// Phase ১ (চ্যানেল বিচ্ছিন্নতা): OrdersList/actions WhatsApp এর /dashboard/orders ফোল্ডারেই
// থাকছে (reuse) — updateOrderStatus/getOrderHistory ইতিমধ্যে orders.channel পড়ে সঠিক queue
// বাছে (WhatsApp/Messenger), তাই ডুপ্লিকেট করলে বরং দুই জায়গায় লজিক আলাদা হয়ে যাওয়ার (ড্রিফট)
// ঝুঁকি বাড়ত। এই পেজ নিজে সম্পূর্ণ Messenger-শুধু — কোয়েরি channel='messenger' ফিল্টার করা।
import OrdersList from "../../orders/OrdersList";

export default async function MessengerOrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at, channel, messenger_pages(page_name)"
    )
    .eq("channel", "messenger")
    .order("created_at", { ascending: false })
    .limit(200);

  const ordersWithPageName = (orders ?? []).map((o) => {
    const page = Array.isArray(o.messenger_pages) ? o.messenger_pages[0] : o.messenger_pages;
    return { ...o, group_name: null, messenger_page_name: page?.page_name ?? null };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">অর্ডার</h1>
        <p className="mt-1 text-xs text-text-muted">Messenger AI চ্যাটবট কথোপকথনে অর্ডার কনফার্ম হলে এখানে অটোমেটিক লিস্ট হবে।</p>
      </div>
      <OrdersList orders={ordersWithPageName} channel="messenger" />
    </div>
  );
}
