import { notFound } from "next/navigation";

// ফ্ল্যাগ বন্ধ থাকলে (ডিফল্ট) /dashboard/email এর নিচে সব রুট 404 — Messenger লেআউটের একই নিয়ম।
// NEXT_PUBLIC_ ভ্যারিয়েবল build-time এ বসে যায় (Dockerfile ARG ও compose build.args এ আছে)
export default function EmailLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_EMAIL_ENABLED !== "true") {
    notFound();
  }

  return <>{children}</>;
}
