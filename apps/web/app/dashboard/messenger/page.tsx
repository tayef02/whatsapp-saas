import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import PageCard from "./PageCard";

const errorMessage: Record<string, string> = {
  oauth_denied: "Facebook এ অনুমতি দেওয়া হয়নি, তাই কানেক্ট করা যায়নি।",
  invalid_state: "লিংকের মেয়াদ শেষ হয়ে গেছে, আবার চেষ্টা করুন।",
  not_configured:
    "Messenger এখনো সেটআপ হয়নি — MESSENGER_APP_ID/MESSENGER_APP_SECRET/MESSENGER_PUBLIC_URL (https দিয়ে শুরু) ঠিকমতো .env এ বসানো আছে কিনা দেখুন।",
  no_pages: "আপনার কোনো Facebook পেজ পাওয়া যায়নি (অ্যাডমিন অ্যাক্সেস আছে এমন পেজ লাগবে)।",
  oauth_failed: "Facebook এর সাথে সংযোগ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।",
  no_workspace: "workspace পাওয়া যায়নি।",
  invalid_page: "বাছাই করা পেজটা খুঁজে পাওয়া যায়নি, আবার চেষ্টা করুন।",
  subscribe_failed: "Webhook সাবস্ক্রাইব করা যায়নি, আবার চেষ্টা করুন।",
  save_failed: "সেভ করা যায়নি, আবার চেষ্টা করুন।",
};

export default async function MessengerConnectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("messenger_pages")
    .select("id, page_name, status, connected_at, bot_enabled")
    .order("connected_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {error && errorMessage[error] && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{errorMessage[error]}</p>}

      {(pages ?? []).map((p) => (
        <PageCard key={p.id} page={p} />
      ))}

      {(pages ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text">Facebook পেজ কানেক্ট করুন</h1>
            <p className="mt-1 text-sm text-text-muted">
              একটা Facebook পেজ কানেক্ট করলে সেই পেজের Messenger ইনবক্স এখান থেকে ম্যানেজ করতে পারবেন।
            </p>
          </div>
          <Link
            href="/dashboard/messenger/connect/start"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            পেজ কানেক্ট করুন
          </Link>
        </Card>
      ) : (
        <Link
          href="/dashboard/messenger/connect/start"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> আরেকটা পেজ কানেক্ট করুন
        </Link>
      )}
    </div>
  );
}
