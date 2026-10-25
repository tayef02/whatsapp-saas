import type { Metadata } from "next";
import { verifyReplyToToken } from "@whatsapp-saas/core/email/tokens";
import { confirmReplyTo } from "./actions";

// URL এ টোকেন (ইমেইলসহ) থাকে — ইনডেক্স/Referer বন্ধ
export const metadata: Metadata = {
  title: "Confirm Reply-To",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmReplyToPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { done, error } = await searchParams;
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const payload = secret ? verifyReplyToToken(secret, token) : null;

  let title: string;
  let body: string;
  let showForm = false;

  if (done) {
    title = "Reply-To ঠিকানা যাচাই হয়েছে";
    body = "ধন্যবাদ! এখন Gen Z CRM-এ ফিরে গিয়ে সেটআপ চেকলিস্ট দেখুন।";
  } else if (!payload) {
    title = "লিংকটি সঠিক নয় বা মেয়াদ শেষ";
    body = "Gen Z CRM-এর ইমেইল সেটআপ পেজ থেকে নতুন কনফার্মেশন মেইল পাঠান।";
  } else {
    title = "এই ঠিকানাটি Reply-To হিসেবে নিশ্চিত করবেন?";
    body = "নিশ্চিত করলে গ্রাহকরা আপনার ইমেইলের উত্তর এই ঠিকানায় পাঠাতে পারবেন।";
    showForm = true;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <p className="mt-3 text-sm text-text-muted">{body}</p>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
            নিশ্চিত করা যায়নি। ঠিকানা বদলে থাকলে নতুন কনফার্মেশন মেইল পাঠান।
          </p>
        )}

        {showForm && (
          <form action={confirmReplyTo} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              নিশ্চিত করুন
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
