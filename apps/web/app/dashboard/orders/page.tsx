import { createClient } from "@/lib/supabase/server";
import OrdersList from "./OrdersList";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at, groups(name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const ordersWithGroupName = (orders ?? []).map((o) => {
    const group = Array.isArray(o.groups) ? o.groups[0] : o.groups;
    return { ...o, group_name: group?.name ?? null };
  });

  return (
    <div>
      <h1>Orders</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        AI চ্যাটবট কথোপকথনে, অথবা গ্রুপে "ORDER: নাম, নাম্বার, প্রোডাক্ট" ফরম্যাটে মেসেজ এলে এখানে অটোমেটিক লিস্ট হবে।
        স্ট্যাটাস বদলাতে ডানপাশের ড্রপডাউন ব্যবহার করুন।
      </p>
      <OrdersList orders={ordersWithGroupName} />
    </div>
  );
}
