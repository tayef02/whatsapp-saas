import { createClient } from "@/lib/supabase/server";
import OrdersList from "./OrdersList";

// Phase ১ (চ্যানেল বিচ্ছিন্নতা): এই পেজ শুধু WhatsApp অর্ডার দেখায় (channel='whatsapp')।
// Messenger অর্ডার আলাদা /dashboard/messenger/orders পেজে (একই OrdersList কম্পোনেন্ট,
// শুধু channel প্রপ আলাদা) — orders.channel ছাড়া আর কোনো ডেটা দুই চ্যানেলের মধ্যে মেশে না
export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at, channel, groups(name)"
    )
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(200);

  const ordersWithGroupName = (orders ?? []).map((o) => {
    const group = Array.isArray(o.groups) ? o.groups[0] : o.groups;
    return { ...o, group_name: group?.name ?? null, messenger_page_name: null };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">অর্ডার</h1>
        <p className="mt-1 text-xs text-text-muted">
          AI চ্যাটবট কথোপকথনে, অথবা গ্রুপে "ORDER: নাম, নাম্বার, প্রোডাক্ট" ফরম্যাটে মেসেজ এলে এখানে অটোমেটিক লিস্ট হবে।
        </p>
      </div>
      <OrdersList orders={ordersWithGroupName} channel="whatsapp" />
    </div>
  );
}
