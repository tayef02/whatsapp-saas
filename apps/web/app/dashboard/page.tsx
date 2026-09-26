import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  return (
    <div>
      <h1>ড্যাশবোর্ড</h1>
      <p>
        <Link href="/dashboard/numbers">WhatsApp নাম্বার ম্যানেজ করুন →</Link>
      </p>
      <p>
        <Link href="/dashboard/contacts">কন্টাক্ট ম্যানেজ করুন →</Link>
      </p>
      <p>
        <Link href="/dashboard/templates">টেমপ্লেট ম্যানেজ করুন →</Link>
      </p>
      <p>
        <Link href="/dashboard/campaigns">ক্যাম্পেইন ম্যানেজ করুন →</Link>
      </p>
      <p>
        <Link href="/dashboard/inbox">Inbox (Auto-Reply কথোপকথন) →</Link>
      </p>
      <p>
        <Link href="/dashboard/ai-chatbot">AI Chatbot (Knowledge Base) →</Link>
      </p>
      <p>
        <Link href="/dashboard/billing">প্ল্যান ও বিলিং →</Link>
      </p>
      <p>
        <Link href="/dashboard/settings">সেটিংস →</Link>
      </p>
      {isSuperAdmin && (
        <p>
          <Link href="/dashboard/admin/payments">🔑 অ্যাডমিন: পেমেন্ট রিভিউ →</Link>
        </p>
      )}
    </div>
  );
}
