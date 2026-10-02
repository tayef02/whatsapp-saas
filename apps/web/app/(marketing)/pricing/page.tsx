import Link from "next/link";
import type { Metadata } from "next";
import { Check, ArrowRight, Gift } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "মূল্য",
  description: "৭ দিন বিনামূল্যে ট্রায়াল, তারপর bKash/Nagad দিয়ে সহজে পেমেন্ট। মেসেজ ও কন্টাক্ট লিমিট অনুযায়ী প্ল্যান বাছাই করুন।",
};

type Plan = {
  id: string;
  name: string;
  price_bdt: number;
  monthly_message_limit: number;
  contact_limit: number;
  max_numbers: number;
  duration_days: number;
  is_trial: boolean;
};

// plans টেবিলে শুধু `authenticated` রোলের GRANT আছে (migration 0012) — পাবলিক মূল্য পেজ
// থেকে anon রোল দিয়ে সরাসরি পড়া যাবে না। নতুন GRANT migration না বানিয়ে, এখানে শুধু
// সার্ভারে (কখনো browser এ যায় না) service_role ক্লায়েন্ট দিয়ে read-only পড়া হচ্ছে।
async function getPlans(): Promise<{ plans: Plan[]; usedFallback: boolean }> {
  // DB থেকে পড়া ব্যর্থ হলে পেজ যেন না ভাঙে — এই মানগুলোই migration 0012 এর বর্তমান seed
  // ডাটা, ফলব্যাক হিসেবে ব্যবহার হচ্ছে (ইউজারের দেওয়া "বর্তমান মান")
  const fallback: Plan[] = [
    { id: "fallback-trial", name: "ট্রায়াল", price_bdt: 0, monthly_message_limit: 100, contact_limit: 200, max_numbers: 1, duration_days: 7, is_trial: true },
    { id: "fallback-starter", name: "স্টার্টার", price_bdt: 990, monthly_message_limit: 2000, contact_limit: 2000, max_numbers: 1, duration_days: 30, is_trial: false },
    { id: "fallback-pro", name: "প্রো", price_bdt: 2490, monthly_message_limit: 10000, contact_limit: 10000, max_numbers: 3, duration_days: 30, is_trial: false },
    { id: "fallback-business", name: "বিজনেস", price_bdt: 4990, monthly_message_limit: 30000, contact_limit: 30000, max_numbers: 10, duration_days: 30, is_trial: false },
  ];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, price_bdt, monthly_message_limit, contact_limit, max_numbers, duration_days, is_trial")
      .eq("is_active", true)
      .order("price_bdt", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.error("[pricing page] plans টেবিল পড়া ব্যর্থ, ফলব্যাক দেখানো হচ্ছে:", error.message);
      return { plans: fallback, usedFallback: true };
    }
    return { plans: data as Plan[], usedFallback: false };
  } catch (err) {
    console.error("[pricing page] plans টেবিল পড়তে এরর, ফলব্যাক দেখানো হচ্ছে:", err instanceof Error ? err.message : err);
    return { plans: fallback, usedFallback: true };
  }
}

function formatNumber(n: number) {
  return n.toLocaleString("bn-BD");
}

export default async function PricingPage() {
  const { plans } = await getPlans();
  const trial = plans.find((p) => p.is_trial);
  const paidPlans = plans.filter((p) => !p.is_trial);

  return (
    <>
      <section className="px-4 pt-16 pb-6 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">মূল্য</div>
        <h1 className="mx-auto mb-3.5 max-w-lg text-[28px] font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">যত পাঠাবেন, ততটুকুর দাম</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-500">bKash/Nagad দিয়ে ম্যানুয়ালি পেমেন্ট — কোনো লুকানো খরচ নেই।</p>
      </section>

      {trial && (
        <section className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 lg:px-10">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Gift className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold text-zinc-900">{trial.duration_days} দিন সম্পূর্ণ বিনামূল্যে</div>
              <div className="mt-1 text-xs text-zinc-600">
                {formatNumber(trial.monthly_message_limit)} মেসেজ, {formatNumber(trial.contact_limit)} কন্টাক্ট, {formatNumber(trial.max_numbers)}টা নাম্বার পর্যন্ত — কার্ড লাগবে না।
              </div>
            </div>
            <Link href="/signup" className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-[13px] font-bold text-white hover:bg-emerald-700">
              ফ্রি ট্রায়াল শুরু করুন
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-10">
        {paidPlans.map((p) => {
          const isPopular = p.name === "প্রো";
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-7 ${
                isPopular ? "border-[1.5px] border-purple-600 bg-[#1e1033] text-white" : "border border-zinc-100 bg-white"
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-6 rounded-full bg-purple-600 px-3 py-1 text-[10.5px] font-bold text-white">সবচেয়ে জনপ্রিয়</span>
              )}
              <div className={`mb-2.5 text-[15px] font-bold ${isPopular ? "text-white" : "text-zinc-900"}`}>{p.name}</div>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className={`text-3xl font-extrabold ${isPopular ? "text-white" : "text-zinc-900"}`}>৳{formatNumber(p.price_bdt)}</span>
                <span className={`text-xs ${isPopular ? "text-purple-200" : "text-zinc-400"}`}>/মাস</span>
              </div>
              <div className={`mb-6 text-xs ${isPopular ? "text-purple-200" : "text-zinc-400"}`}>
                {formatNumber(p.duration_days)} দিন মেয়াদ
              </div>
              <Link
                href="/signup"
                className={`mb-6 block rounded-xl py-2.5 text-center text-[13px] font-bold ${
                  isPopular ? "bg-purple-600 text-white hover:bg-purple-500" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                }`}
              >
                শুরু করুন
              </Link>
              <div className={`mb-4 h-px ${isPopular ? "bg-white/10" : "bg-zinc-100"}`} />
              <div className="flex flex-col gap-2.5">
                {[
                  `মাসে ${formatNumber(p.monthly_message_limit)} মেসেজ`,
                  `${formatNumber(p.contact_limit)} কন্টাক্ট পর্যন্ত`,
                  `${formatNumber(p.max_numbers)}টা WhatsApp নাম্বার`,
                  "AI চ্যাটবট ও গ্রুপ টুলস",
                  "bKash/Nagad পেমেন্ট",
                ].map((perk) => (
                  <div key={perk} className={`flex items-center gap-2 text-xs ${isPopular ? "text-purple-100" : "text-zinc-600"}`}>
                    <Check className={`h-3.5 w-3.5 shrink-0 ${isPopular ? "text-purple-300" : "text-purple-600"}`} strokeWidth={2.5} />
                    {perk}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6 lg:px-10">
        <div className="flex items-start gap-4 rounded-2xl bg-purple-50/40 p-7">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">৳</div>
          <div>
            <div className="mb-1.5 text-[13.5px] font-bold text-zinc-900">পেমেন্ট কীভাবে করবো?</div>
            <p className="text-xs leading-relaxed text-zinc-500">
              bKash বা Nagad দিয়ে ম্যানুয়ালি পেমেন্ট করা যায় — কোনো ইন্টারন্যাশনাল কার্ড বা অটো-পেমেন্ট সাবস্ক্রিপশন নেই। পেমেন্ট করার পর
              অ্যাপের ভেতর থেকে কনফার্ম করলেই প্ল্যান চালু হয়ে যায়।
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-purple-900 to-purple-600 px-4 py-16 text-center sm:px-6 lg:px-10">
        <h2 className="mb-3.5 text-xl font-extrabold text-white sm:text-2xl">কোন প্ল্যান বেছে নেবেন বুঝতে পারছেন না?</h2>
        <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[13.5px] font-bold text-purple-700 hover:bg-purple-50">
          আমাদের সাথে যোগাযোগ করুন
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
