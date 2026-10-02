import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Header from "./_components/Header";
import Footer from "./_components/Footer";

// পাবলিক মার্কেটিং সাইট (Gen Z CRM) — /dashboard এর আলাদা, শুধু এই route group এর পেজগুলো
// Header/Footer পাবে। root layout.tsx এর html/body-ই এখানেও প্রযোজ্য (Noto Sans Bengali +
// Inter ফন্ট ভ্যারিয়েবল আগে থেকেই আছে, নতুন করে লোড করার দরকার নেই) — শুধু রং আলাদা রাখা
// হয়েছে Tailwind এর stock purple-* প্যালেট দিয়ে, ড্যাশবোর্ডের কাস্টম সবুজ টোকেনের সাথে
// সংঘর্ষ এড়াতে (বিস্তারিত docs/website-plan.md তে)
export const metadata: Metadata = {
  title: {
    default: "Gen Z CRM — বাংলাদেশের WhatsApp মার্কেটিং CRM",
    template: "%s | Gen Z CRM",
  },
  description: "ক্যাম্পেইন পাঠান, AI দিয়ে কাস্টমারের রিপ্লাই দিন, অর্ডার ট্র্যাক করুন — সব এক জায়গা থেকে। বাংলাদেশের ছোট ও মাঝারি ব্যবসার জন্য তৈরি।",
  openGraph: {
    siteName: "Gen Z CRM",
    locale: "bn_BD",
    type: "website",
  },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <Header isLoggedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
