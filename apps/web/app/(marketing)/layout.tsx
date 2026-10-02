import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Header from "./_components/Header";
import Footer from "./_components/Footer";
import { getLang } from "./_lib/get-lang";
import { getContent } from "./_lib/content";

// পাবলিক মার্কেটিং সাইট (Gen Z CRM) — /dashboard এর আলাদা, শুধু এই route group এর পেজগুলো
// Header/Footer পাবে। root layout.tsx এর html/body-ই এখানেও প্রযোজ্য (Noto Sans Bengali +
// Inter ফন্ট ভ্যারিয়েবল আগে থেকেই আছে) — শুধু রং আলাদা রাখা হয়েছে Tailwind এর stock purple-*
// প্যালেট দিয়ে, ড্যাশবোর্ডের কাস্টম সবুজ/বেগুনি টোকেনের সাথে সংঘর্ষ এড়াতে (docs/website-plan.md)।
//
// ভাষা: ডিফল্ট English, কুকি (gz_lang) দিয়ে বাংলা — লেআউট কুকি পড়ে বলে এই গ্রুপের সব পেজ
// ডাইনামিক রেন্ডার হয় (আগে থেকেই auth চেকের কারণে ডাইনামিক ছিল, নতুন কোনো খরচ নেই)
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const m = getContent(lang).meta;
  return {
    title: { default: m.homeTitle, template: m.template },
    description: m.homeDescription,
    openGraph: {
      siteName: "Gen Z CRM",
      locale: lang === "bn" ? "bn_BD" : "en_US",
      type: "website",
    },
  };
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = getContent(lang);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div lang={lang} className="flex min-h-screen flex-col bg-white text-zinc-900">
      <Header isLoggedIn={Boolean(user)} lang={lang} nav={t.nav} />
      <main className="flex-1">{children}</main>
      <Footer t={t.footer} />
    </div>
  );
}
