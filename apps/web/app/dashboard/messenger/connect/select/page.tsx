import { cookies } from "next/headers";
import Link from "next/link";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Card, Button, EmptyState } from "@/components/ui";
import { connectPage } from "../actions";

const PAGES_COOKIE = "messenger_oauth_pages";

type PendingPage = { pageId: string; pageName: string };

export default async function SelectMessengerPagePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PAGES_COOKIE)?.value;

  let pages: PendingPage[] = [];
  if (raw) {
    try {
      // pageAccessToken ইচ্ছাকৃতভাবে এই টাইপে নেই — সার্ভার কম্পোনেন্ট থেকে client এ কখনো
      // পাঠানো হচ্ছে না, শুধু নাম/আইডি দেখানো হচ্ছে। token connectPage() action আলাদাভাবে
      // কুকি থেকে সরাসরি পড়ে (নিচে দেখুন)
      const parsed = JSON.parse(raw) as Array<{ pageId: string; pageName: string }>;
      pages = parsed.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
    } catch {
      pages = [];
    }
  }

  if (pages.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="পেজের তালিকা পাওয়া যায়নি"
          description="লিংক মেয়াদ শেষ হয়ে গেছে অথবা আগেই ব্যবহার হয়ে গেছে। আবার চেষ্টা করুন।"
          action={
            <Link href="/dashboard/messenger" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> পেজ কানেক্ট পেজে ফিরুন
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-1 text-base font-semibold text-text">কোন পেজ কানেক্ট করবেন</h1>
        <p className="mb-4 text-sm text-text-muted">আপনার নিয়ন্ত্রণে থাকা Facebook পেজের তালিকা — যেটা কানেক্ট করতে চান বাছাই করুন।</p>

        <div className="flex flex-col gap-2">
          {pages.map((p) => (
            <form key={p.pageId} action={connectPage}>
              <input type="hidden" name="pageId" value={p.pageId} />
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                <span className="truncate text-sm font-medium text-text">{p.pageName}</span>
                <Button type="submit" className="shrink-0">
                  কানেক্ট করুন
                </Button>
              </div>
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
