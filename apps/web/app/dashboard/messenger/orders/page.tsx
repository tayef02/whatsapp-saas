import { createClient } from "@/lib/supabase/server";
// Phase ১ (চ্যানেল বিচ্ছিন্নতা): OrdersList/actions WhatsApp এর /dashboard/orders ফোল্ডারেই
// থাকছে (reuse) — updateOrderStatus/getOrderHistory ইতিমধ্যে orders.channel পড়ে সঠিক queue
// বাছে (WhatsApp/Messenger), তাই ডুপ্লিকেট করলে বরং দুই জায়গায় লজিক আলাদা হয়ে যাওয়ার (ড্রিফট)
// ঝুঁকি বাড়ত। এই পেজ নিজে সম্পূর্ণ Messenger-শুধু — কোয়েরি channel='messenger' ফিল্টার করা।
import OrdersList from "../../orders/OrdersList";

const PAGE_SIZE = 20;

function sanitizeSearch(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

export default async function MessengerOrdersPage({
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
      "id, order_number, contact_phone, product_name, quantity, delivery_name, delivery_phone, delivery_address, status, cancel_reason, raw_summary, created_at, channel, messenger_pages(page_name)",
      { count: "exact" }
    )
    .eq("channel", "messenger");

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

  const ordersWithPageName = (orders ?? []).map((o) => {
    const messengerPage = Array.isArray(o.messenger_pages) ? o.messenger_pages[0] : o.messenger_pages;
    return { ...o, group_name: null, messenger_page_name: messengerPage?.page_name ?? null };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">অর্ডার</h1>
        <p className="mt-1 text-xs text-text-muted">Messenger AI চ্যাটবট কথোপকথনে অর্ডার কনফার্ম হলে এখানে অটোমেটিক লিস্ট হবে।</p>
      </div>
      <OrdersList orders={ordersWithPageName} channel="messenger" page={page} totalPages={totalPages} q={q ?? ""} status={status ?? ""} />
    </div>
  );
}
