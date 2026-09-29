import Link from "next/link";
import { Plus, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { getDhakaDayBoundariesUtc } from "@/lib/format-date";
import NumbersList from "./NumbersList";

export default async function NumbersPage() {
  const supabase = await createClient();

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name, phone_number, status, qr_code, daily_message_limit, connected_at, created_at, bot_enabled")
    .order("created_at", { ascending: false });

  const numberIds = (numbers ?? []).map((n) => n.id);

  // আজকের পাঠানো — একবারে সব রো এনে নাম্বার অনুযায়ী গোনা হচ্ছে (প্রতি কার্ডে আলাদা কোয়েরির বদলে)
  const { startIso: todayStart } = getDhakaDayBoundariesUtc(0);
  const sentTodayByNumber: Record<string, number> = {};
  if (numberIds.length > 0) {
    const { data: sentRows } = await supabase
      .from("messages")
      .select("whatsapp_number_id")
      .gte("sent_at", todayStart)
      .in("status", ["sent", "delivered", "read"])
      .in("whatsapp_number_id", numberIds);
    for (const row of sentRows ?? []) {
      sentTodayByNumber[row.whatsapp_number_id] = (sentTodayByNumber[row.whatsapp_number_id] ?? 0) + 1;
    }
  }

  // বট অন/অফ — whatsapp_numbers.bot_enabled কলাম থেকেই সরাসরি (আগে আলাদা chatbot_configs
  // টেবিলের জন্য দ্বিতীয় কোয়েরি লাগত, migration 0037 এর পর আর দরকার নেই)
  const botActiveByNumber: Record<string, boolean> = {};
  for (const n of numbers ?? []) {
    botActiveByNumber[n.id] = n.bot_enabled;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">WhatsApp নাম্বার</h1>
        <Link
          href="/dashboard/numbers/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> নতুন নাম্বার যোগ করুন
        </Link>
      </div>

      {(!numbers || numbers.length === 0) && (
        <EmptyState
          icon={<Smartphone className="h-10 w-10" />}
          title="এখনো কোনো নাম্বার যোগ করা হয়নি"
          description="প্রথম WhatsApp নাম্বার কানেক্ট করে ক্যাম্পেইন পাঠানো শুরু করুন।"
          action={
            <Link
              href="/dashboard/numbers/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> নাম্বার কানেক্ট করুন
            </Link>
          }
        />
      )}

      {numbers && numbers.length > 0 && (
        <NumbersList numbers={numbers} sentTodayByNumber={sentTodayByNumber} botActiveByNumber={botActiveByNumber} />
      )}
    </div>
  );
}
