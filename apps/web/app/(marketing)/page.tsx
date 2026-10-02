import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Sparkles, CheckCircle2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Gen Z CRM — ক্যাম্পেইন, AI চ্যাটবট ও অর্ডার এক জায়গায়",
};

const trustItems = [
  { title: "প্রতি নাম্বারে দৈনিক সীমা", desc: "এক নাম্বার থেকে একসাথে অনেক মেসেজ গেলে WhatsApp ব্যান করে দিতে পারে — তাই প্রতিদিনের একটা সর্বোচ্চ সীমা বাধ্যতামূলক।" },
  { title: "ওয়ার্ম-আপ মোড", desc: "নতুন কানেক্ট করা নাম্বারে প্রথম কয়েকদিন কম মেসেজ, ধীরে ধীরে বাড়ে — ব্যান হওয়ার ঝুঁকি কমে।" },
  { title: "র‍্যান্ডম ডিলে ও Spintax", desc: "মেসেজের মাঝে এলোমেলো বিরতি, আর {নমস্কার|হ্যালো} জাতীয় বৈচিত্র্য — বট-এর মতো লাগা এড়ায়।" },
  { title: "STOP লিখলে অটো বন্ধ", desc: "কাস্টমার \"STOP\" বা \"বন্ধ\" লিখলে তার নাম্বারে আর কোনো ক্যাম্পেইন মেসেজ যাবে না।" },
  { title: "ব্যান হলে সাথে সাথে জানাই", desc: "কোনো নাম্বার ডিসকানেক্ট/ব্যান হলে ইন-অ্যাপ ও ইমেইলে সাথে সাথে নোটিফিকেশন যায়।" },
  { title: "নকল পরিসংখ্যান দেখাই না", desc: "আমরা মিথ্যা গ্রাহক সংখ্যা বা রিভিউ দেখাই না — যা সত্যি, শুধু তাই বলি।" },
];

const features = [
  { title: "ক্যাম্পেইন", desc: "টেক্সট, ছবি, PDF — টেমপ্লেট দিয়ে শিডিউল করে পাঠান।" },
  { title: "AI চ্যাটবট", desc: "আপনার নলেজ বেস থেকে কাস্টমারের প্রশ্নের উত্তর দেয়।" },
  { title: "ইনবক্স", desc: "সব কথোপকথন এক জায়গায়, দরকারে নিজে রিপ্লাই দিন।" },
  { title: "অর্ডার ট্র্যাকিং", desc: "চ্যাটেই অর্ডার কনফার্ম, স্ট্যাটাস বদলালে অটো আপডেট।" },
  { title: "গ্রুপ টুলস", desc: "কিওয়ার্ড রিপ্লাই, ওয়েলকাম মেসেজ, স্প্যাম ফিল্টার — অটোমেটিক চলে।" },
];

const faqPreview = [
  { q: "আমার WhatsApp নাম্বার ব্যান হবে না তো?", a: "প্রতি নাম্বারে দৈনিক সীমা, ওয়ার্ম-আপ মোড আর র‍্যান্ডম ডিলে — এই তিনটা মিলিয়ে ব্যানের ঝুঁকি অনেক কমে যায়।" },
  { q: "AI বট কীভাবে উত্তর দেয়?", a: "আপনার দেওয়া নলেজ বেস (PDF/Excel) আর সিস্টেম প্রম্পট থেকেই — কোনো হার্ডকোড করা নিয়ম নেই।" },
  { q: "পেমেন্ট কীভাবে করবো?", a: "bKash বা Nagad দিয়ে ম্যানুয়ালি — কার্ড লাগবে না।" },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  return (
    <>
      {/* হিরো */}
      <section className="relative overflow-hidden px-4 pt-20 pb-20 sm:px-6 sm:pt-24 lg:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[900px] -translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.35),transparent_65%)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-purple-600">
              <Sparkles className="h-3.5 w-3.5" />
              বাংলাদেশের WhatsApp মার্কেটিং CRM
            </div>
            <h1 className="mb-5 text-[32px] leading-[1.2] font-extrabold tracking-tight text-zinc-900 sm:text-[42px] sm:leading-[1.18] lg:text-[48px]">
              ক্যাম্পেইন পাঠান, AI দিয়ে রিপ্লাই দিন, সব এক জায়গা থেকে।
            </h1>
            <p className="mb-7 max-w-[480px] text-[14.5px] leading-relaxed text-zinc-600">
              Gen Z CRM একটা অল-ইন-ওয়ান WhatsApp মার্কেটিং টুল — ক্যাম্পেইন পাঠায়, AI দিয়ে কাস্টমারের রিপ্লাই দেয়, অর্ডার ট্র্যাক করে, তাই ৬টা অ্যাপের বদলে একটাতেই সব সামলানো যায়।
            </p>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700"
              >
                ড্যাশবোর্ডে যান
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700"
                >
                  ৩ দিনের ফ্রি ট্রায়াল শুরু করুন
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-3 text-xs text-zinc-400">কার্ড লাগবে না · যেকোনো সময় বাতিল</p>
              </>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-[460px] pt-8 pb-14">
            <div className="absolute top-0 left-10 z-10 flex items-center gap-1.5 rounded-full bg-white py-2 pr-3.5 pl-2.5 text-xs font-bold text-zinc-700 shadow-[0_10px_30px_rgba(24,24,27,0.14)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              তৈরি, শিডিউল, পাঠান, বিশ্লেষণ করুন
            </div>
            <div className="relative mt-9 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-[0_30px_70px_rgba(24,24,27,0.14)]">
              <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3.5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-red-300" />
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="text-xs font-bold text-zinc-900">
                  ড্যাশবোর্ড <span className="font-medium text-zinc-400">· ক্যাম্পেইন, ইনবক্স, অর্ডার এক নজরে</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: "AI", l: "চ্যাটবট" },
                    { v: "📦", l: "অর্ডার" },
                    { v: "👥", l: "গ্রুপ" },
                    { v: "📊", l: "রিপোর্ট" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-purple-50 p-2.5 text-center">
                      <div className="text-sm font-extrabold text-zinc-900">{s.v}</div>
                      <div className="mt-0.5 text-[9px] text-zinc-400">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <div className="mb-1.5 flex justify-between text-[10.5px] text-zinc-500">
                    <span>সক্রিয় ক্যাম্পেইন</span>
                    <span className="font-bold text-purple-700">চলছে</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-purple-100">
                    <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-purple-400 to-purple-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* কেন বিশ্বাস করবেন */}
      <section className="bg-[#0f0a19] px-4 py-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-2.5 text-xs font-bold text-purple-300">কেন বিশ্বাস করবেন</div>
          <h2 className="mx-auto mb-3.5 max-w-xl text-2xl font-extrabold tracking-tight text-white sm:text-[30px]">আপনার নাম্বার ব্যান ঠেকাতে তৈরি</h2>
          <p className="mx-auto mb-11 max-w-lg text-sm leading-relaxed text-[#c4b5d4]">
            আমরা মিথ্যা গ্রাহক সংখ্যা দেখাই না — যা সত্যি, শুধু তাই বলি। নিচের প্রতিটা নিরাপত্তা ফিচার প্রোডাক্টেই আছে।
          </p>
          <div className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
            {trustItems.map((t) => (
              <div key={t.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-purple-300/15">
                  <CheckCircle2 className="h-4 w-4 text-purple-300" />
                </div>
                <div className="mb-1.5 text-[13.5px] font-bold text-white">{t.title}</div>
                <div className="text-xs leading-relaxed text-[#a89bb8]">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ফিচার */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <div className="mb-12 text-center">
          <div className="mb-2.5 text-xs font-bold text-purple-600">ফিচার</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[30px]">যা যা করতে পারবেন</h2>
        </div>
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-100 p-6 hover:border-purple-200">
              <div className="mb-4 text-lg font-extrabold text-purple-600">{f.title[0]}</div>
              <div className="mb-1.5 text-[14.5px] font-bold text-zinc-900">{f.title}</div>
              <div className="text-xs leading-relaxed text-zinc-500">{f.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/features" className="text-sm font-bold text-purple-600 hover:underline">
            সব ফিচার দেখুন →
          </Link>
        </div>
      </section>

      {/* চ্যানেল */}
      <section className="bg-purple-50/40 px-4 py-[72px] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center mb-10">
          <div className="mb-2.5 text-xs font-bold text-purple-600">চ্যানেল</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[28px]">যেখানে আপনার কাস্টমার আছে</h2>
        </div>
        <div className="mx-auto grid max-w-3xl gap-[18px] sm:grid-cols-2">
          <div className="relative rounded-2xl border-[1.5px] border-purple-300 bg-white p-6">
            <span className="absolute -top-2.5 right-5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white">লাইভ</span>
            <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="mb-1.5 text-base font-extrabold text-zinc-900">WhatsApp</div>
            <p className="text-xs leading-relaxed text-zinc-500">ক্যাম্পেইন, AI চ্যাটবট, গ্রুপ অটোমেশন, অর্ডার — সবকিছু চালু আছে।</p>
          </div>
          <div className="relative rounded-2xl border border-zinc-100 bg-white p-6 opacity-75">
            <span className="absolute -top-2.5 right-5 rounded-full bg-zinc-500 px-2.5 py-0.5 text-[10px] font-bold text-white">শীঘ্রই আসছে</span>
            <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="mb-1.5 text-base font-extrabold text-zinc-900">Messenger</div>
            <p className="text-xs leading-relaxed text-zinc-500">কমেন্ট অটোমেশন, পোস্ট শিডিউলার, ইনবক্স — টেস্টিং চলছে।</p>
          </div>
        </div>
      </section>

      {/* মূল্য টিজার */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">মূল্য</div>
        <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[30px]">যত পাঠাবেন, ততটুকুর দাম</h2>
        <p className="mx-auto mb-10 max-w-md text-sm text-zinc-500">৭ দিন বিনামূল্যে ট্রায়াল, তারপর bKash/Nagad দিয়ে সহজে পেমেন্ট।</p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700"
        >
          সব প্ল্যান ও দাম দেখুন
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* FAQ প্রিভিউ */}
      <section className="bg-purple-50/40 px-4 py-[72px] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-9 text-center">
            <div className="mb-2.5 text-xs font-bold text-purple-600">প্রশ্নোত্তর</div>
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl">সাধারণ কিছু প্রশ্ন</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {faqPreview.map((q) => (
              <div key={q.q} className="rounded-xl border border-zinc-100 bg-white p-5">
                <div className="mb-1.5 text-[13.5px] font-bold text-zinc-900">{q.q}</div>
                <div className="text-xs leading-relaxed text-zinc-500">{q.a}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link href="/faq" className="text-sm font-bold text-purple-600 hover:underline">
              সব প্রশ্ন দেখুন →
            </Link>
          </div>
        </div>
      </section>

      {/* শেষ CTA */}
      {!isLoggedIn && (
        <section className="bg-gradient-to-br from-purple-900 to-purple-600 px-4 py-20 text-center sm:px-6 lg:px-10">
          <h2 className="mx-auto mb-3.5 max-w-lg text-2xl font-extrabold tracking-tight text-white sm:text-[30px]">আজই শুরু করুন, ৩ দিন সম্পূর্ণ ফ্রি</h2>
          <p className="mx-auto mb-6 max-w-sm text-sm text-purple-100">কার্ড লাগবে না। যেকোনো সময় বাতিল করতে পারবেন।</p>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-purple-700 hover:bg-purple-50">
            ফ্রি ট্রায়াল শুরু করুন
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </>
  );
}
