import { notFound } from "next/navigation";

// ফ্ল্যাগ বন্ধ থাকলে (ডিফল্ট) /dashboard/messenger এর নিচে সব রুট 404 — শুধু সাইডবার থেকে
// লিংক লুকানো যথেষ্ট না, সরাসরি URL টাইপ করলেও যেন কিছু না দেখা যায়
export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_MESSENGER_ENABLED !== "true") {
    notFound();
  }

  return <>{children}</>;
}
