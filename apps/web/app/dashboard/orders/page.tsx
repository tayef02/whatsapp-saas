import { createClient } from "@/lib/supabase/server";
import OrdersList from "./OrdersList";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1>Orders</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        AI চ্যাটবট কথোপকথনে কাস্টমারের কাছ থেকে অর্ডার কনফার্ম করলে এখানে অটোমেটিক লিস্ট হবে। স্ট্যাটাস বদলাতে ডানপাশের ড্রপডাউন ব্যবহার করুন।
      </p>
      <OrdersList orders={orders ?? []} />
    </div>
  );
}
