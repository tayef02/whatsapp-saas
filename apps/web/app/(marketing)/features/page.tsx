import Link from "next/link";
import type { Metadata } from "next";
import { Check, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "ফিচার",
  description: "WhatsApp ক্যাম্পেইন, AI চ্যাটবট, ইনবক্স, অর্ডার ট্র্যাকিং, গ্রুপ টুলস — Gen Z CRM এ যা যা কাজ করে, বিস্তারিত।",
};

const categories = [
  {
    title: "ক্যাম্পেইন ও মেসেজিং",
    items: [
      { title: "নাম্বার কানেক্ট", desc: "QR স্ক্যান করে WhatsApp নাম্বার কানেক্ট করুন, কানেকশন স্ট্যাটাস লাইভ দেখুন।" },
      { title: "কন্টাক্ট ইমপোর্ট", desc: "CSV/Excel থেকে এক ক্লিকে, ডুপ্লিকেট বাদ, নাম্বার অটো-ফরম্যাট (01XXX → 8801XXX)।" },
      { title: "টেমপ্লেট", desc: "{{name}} ভেরিয়েবল আর স্পিনট্যাক্স দিয়ে প্রতিটা মেসেজ একটু আলাদা।" },
      { title: "ক্যাম্পেইন", desc: "টেক্সট + ছবি/PDF, অডিয়েন্স বাছাই, শিডিউল, র‍্যান্ডম ডিলে।" },
      { title: "ডেলিভারি রিপোর্ট", desc: "Sent/Delivered/Read/Failed — ব্যর্থ হলে আবার পাঠান।" },
    ],
  },
  {
    title: "AI চ্যাটবট ও ইনবক্স",
    items: [
      { title: "নলেজ বেস থেকে উত্তর", desc: "আপনার PDF/Excel/CSV/TXT আপলোড করুন, কোনো হার্ডকোড করা নিয়ম ছাড়াই AI উত্তর দেয়।" },
      { title: "মাল্টি-টার্ন কথোপকথন", desc: "শেষ ১০টা মেসেজের প্রসঙ্গ মনে রাখে, জটিল প্রশ্নেও ধাপে ধাপে উত্তর দেয়।" },
      { title: "মানুষ এজেন্টের কাছে হ্যান্ডঅফ", desc: "AI না বুঝলে নিজে থেকেই জানিয়ে দেয়, আপনি চাইলে নিজে রিপ্লাই দিতে পারেন।" },
      { title: "ইনবক্স", desc: "সব কথোপকথন এক জায়গায় — AI/এজেন্ট রিপ্লাই, মিডিয়া থাম্বনেইল সহ।" },
    ],
  },
  {
    title: "গ্রুপ টুলস",
    items: [
      { title: "গ্রুপ সিঙ্ক", desc: "নাম, মেম্বার, অ্যাডমিন লিস্ট, ইনভাইট লিংক জেনারেট/রোটেট।" },
      { title: "কিওয়ার্ড/@mention রিপ্লাই", desc: "ফিক্সড টেক্সট বা AI রিপ্লাই, per-rule cooldown।" },
      { title: "ওয়েলকাম মেসেজ", desc: "নতুন মেম্বার যোগ হলেই স্বাগতম মেসেজ, গ্রুপের নাম/লিংক বসিয়ে।" },
      { title: "স্প্যাম/লিংক ফিল্টার", desc: "বট অ্যাডমিন হলে অটো-ডিলিট, না হলে ড্যাশবোর্ড নোটিফিকেশন।" },
      { title: "শিডিউলড অ্যানাউন্সমেন্ট", desc: "একাধিক গ্রুপে staggered delay সহ, দৈনিক লিমিট মেনে।" },
    ],
  },
  {
    title: "অর্ডার ও সেফটি",
    items: [
      { title: "অর্ডার অটো-ক্যাপচার", desc: "চ্যাটেই অর্ডার কনফার্ম হলে ছোট readable order ID সহ সেভ হয়।" },
      { title: "স্ট্যাটাস আপডেট", desc: "ড্যাশবোর্ড থেকে স্ট্যাটাস বদলালে কাস্টমারকে WhatsApp-এ অটো জানানো হয়।" },
      { title: "নাম্বার ব্যান-প্রোটেকশন", desc: "দৈনিক সীমা, ওয়ার্ম-আপ মোড, র‍্যান্ডম ডিলে, STOP অটো opt-out।" },
    ],
  },
];

const comingSoon = ["Messenger কমেন্ট অটোমেশন", "Messenger পোস্ট শিডিউলার", "টিম অ্যাসাইন", "নাম্বার চেকার", "বাংলা টেমপ্লেট লাইব্রেরি"];

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-purple-50/40 px-4 py-16 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">ফিচার</div>
        <h1 className="mx-auto mb-3.5 max-w-xl text-[28px] font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">যা যা করতে পারবেন, বিস্তারিত</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-500">শুধু যেগুলো এখন সত্যিই কাজ করে, তার তালিকা — কোনো মিথ্যা দাবি নেই।</p>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-14 px-4 py-16 sm:px-6 lg:px-10">
        {categories.map((cat) => (
          <div key={cat.title}>
            <div className="mb-5 text-lg font-extrabold text-zinc-900">{cat.title}</div>
            <div className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-100">
              {cat.items.map((it) => (
                <div key={it.title} className="flex gap-3 p-5 hover:bg-purple-50/40">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" strokeWidth={2.5} />
                  <div>
                    <div className="text-[13.5px] font-bold text-zinc-900">{it.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-7">
          <div className="mb-2.5 text-[13.5px] font-extrabold text-zinc-900">শীঘ্রই আসছে</div>
          <div className="flex flex-wrap gap-2">
            {comingSoon.map((c) => (
              <span key={c} className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-purple-900 to-purple-600 px-4 py-16 text-center sm:px-6 lg:px-10">
        <h2 className="mb-3.5 text-xl font-extrabold text-white sm:text-2xl">আজই শুরু করুন, ৩ দিন সম্পূর্ণ ফ্রি</h2>
        <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[13.5px] font-bold text-purple-700 hover:bg-purple-50">
          ফ্রি ট্রায়াল শুরু করুন
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
