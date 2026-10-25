import type { Metadata } from "next";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe";
import { confirmUnsubscribe } from "./actions";

// URL এ টোকেন (মানে প্রাপকের ইমেইল) থাকে — সার্চ ইঞ্জিনে ইনডেক্স হবে না, আর অন্য সাইটে
// Referer হিসেবে যাবে না
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// ইমেইলের প্রাপক অচেনা (লগইন/ভাষা-কুকি নেই), তাই বাংলা আর English একসাথে
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { done, error } = await searchParams;
  const payload = readUnsubscribeToken(token);

  let title: string;
  let titleEn: string;
  let body: string;
  let bodyEn: string;
  let showForm = false;

  if (!payload) {
    title = "লিংকটি সঠিক নয়";
    titleEn = "This link is not valid";
    body = "লিংকটি অসম্পূর্ণ বা পরিবর্তিত। ইমেইল থেকে আবার লিংকটি খুলুন।";
    bodyEn = "The link is incomplete or has been altered. Please open it again from the email.";
  } else if (done) {
    title = "আপনাকে আনসাবস্ক্রাইব করা হয়েছে";
    titleEn = "You have been unsubscribed";
    body = "এই প্রেরকের কাছ থেকে আপনি আর কোনো ইমেইল পাবেন না।";
    bodyEn = "You will not receive any more emails from this sender.";
  } else {
    title = "আনসাবস্ক্রাইব করবেন?";
    titleEn = "Unsubscribe?";
    body = "নিশ্চিত করলে এই প্রেরকের কাছ থেকে আপনি আর কোনো ইমেইল পাবেন না।";
    bodyEn = "If you confirm, you will not receive any more emails from this sender.";
    showForm = true;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <p className="text-sm text-text-muted">{titleEn}</p>

        <p className="mt-4 text-sm text-text">{body}</p>
        <p className="mt-1 text-sm text-text-muted">{bodyEn}</p>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
            কিছু একটা ভুল হয়েছে, একটু পরে আবার চেষ্টা করুন। / Something went wrong, please try again.
          </p>
        )}

        {showForm && (
          <form action={confirmUnsubscribe} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              আনসাবস্ক্রাইব করুন / Unsubscribe
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
