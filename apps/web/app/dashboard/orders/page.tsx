import { createClient } from "@/lib/supabase/server";
import OrdersList from "./OrdersList";

const PAGE_SIZE = 20;

// contacts পেজের একই প্যাটার্ন — PostgREST এর or() ফিল্টারে কমা/ব্র্যাকেট বিশেষ অর্থ বহন করে
function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

// Phase ১ (চ্যানেল বিচ্ছিন্নতা): এই পেজ শুধু WhatsApp অর্ডার দেখায় (channel='whatsapp')।
// Messenger অর্ডার আলাদা /dashboard/messenger/orders পেজে (একই OrdersList কম্পোনেন্ট,
// শুধু channel প্রপ আলাদা) — orders.channel ছাড়া আর কোনো ডেটা দুই চ্যানেলের মধ্যে মেশে না
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const { page: pageParam, q, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at, channel, groups(name)",
      { count: "exact" }
    )
    .eq("channel", "whatsapp");

  if (q) {
    const safe = sanitizeSearch(q);
    if (safe) {
      const isNumeric = /^\d+$/.test(safe);
      const orParts = [
        `contact_phone.ilike.%${safe}%`,
        `delivery_name.ilike.%${safe}%`,
        `delivery_phone.ilike.%${safe}%`,
        `product_name.ilike.%${safe}%`,
      ];
      if (isNumeric) orParts.push(`order_number.eq.${safe}`);
      query = query.or(orParts.join(","));
    }
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: orders, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

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
      <OrdersList orders={ordersWithGroupName} channel="whatsapp" page={page} totalPages={totalPages} q={q ?? ""} status={status ?? ""} />
    </div>
  );
}
