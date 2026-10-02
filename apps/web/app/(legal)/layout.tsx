import Link from "next/link";
import LogoMark from "@/components/brand/LogoMark";

// /terms, /privacy, /data-deletion — তিনটাই পাবলিক পেজ (middleware.ts এ allow-list করা),
// সাইডবার/ড্যাশবোর্ড শেল ছাড়া একদম সাধারণ একটা কনটেইনার। লগইন ছাড়াই যে কেউ দেখতে পারবে।
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-bg">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={32} />
            <span className="text-sm font-bold text-primary">Gen Z CRM</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
