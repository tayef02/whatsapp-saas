import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Heart, MapPin, Shield, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "আমাদের সম্পর্কে",
  description: "Gen Z CRM — Gen Z IT Zone-এর পণ্য, বাংলাদেশের ছোট ও মাঝারি ব্যবসার জন্য WhatsApp মার্কেটিং সহজ করতে তৈরি।",
};

const values = [
  { icon: Heart, title: "সততা আগে", desc: "আমরা নকল গ্রাহক সংখ্যা বা নকল রিভিউ দেখাই না। যা সত্যি, শুধু তাই বলি।" },
  { icon: MapPin, title: "বাংলাদেশ-ফার্স্ট", desc: "সম্পূর্ণ বাংলা ইন্টারফেস, bKash/Nagad পেমেন্ট — বিদেশি টুলের ঝামেলা ছাড়াই।" },
  { icon: Shield, title: "নাম্বার নিরাপত্তা", desc: "দ্রুত বিক্রি বাড়ানোর লোভে নাম্বার ব্যান করানোর বদলে, ধীরে ও নিরাপদে স্কেল করা শেখাই।" },
  { icon: Sparkles, title: "সরলতা", desc: "টেকনিক্যাল না হলেও ব্যবহার করা যায় — জটিল সেটআপ বা কোডিং জানা লাগে না।" },
];

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">আমাদের সম্পর্কে</div>
        <h1 className="mb-6 text-[26px] font-extrabold tracking-tight text-zinc-900 sm:text-[32px]">বাংলাদেশের ব্যবসার জন্য, বাংলাদেশ থেকেই</h1>
        <p className="text-[14.5px] leading-[1.9] text-zinc-600">
          বাংলাদেশের বেশিরভাগ ছোট ও মাঝারি ব্যবসা এখনো হাতে হাতে WhatsApp মেসেজ পাঠান, কাস্টমারের প্রশ্নের উত্তর দিতে রাত জাগেন, আর
          একটা জায়গায় বিক্রি-অর্ডার-কাস্টমার সামলানোর কোনো সহজ উপায় পান না।
          <br />
          <br />
          Gen Z CRM বানানো হয়েছে এই সমস্যাগুলো সমাধান করতে — একটা "ওয়ান-ইন-ওয়ান" জায়গা, যেখানে আপনি গ্রাহকদের সাথে কথা বলতে পারবেন,
          বিক্রি করতে পারবেন, আর অর্ডার সামলাতে পারবেন, সবকিছু বাংলায়। <strong className="font-bold text-zinc-900">Gen Z IT Zone</strong>-এর পণ্য
          হিসেবে তৈরি।
        </p>
      </section>

      <section className="bg-purple-50/40 px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-3xl gap-[18px] sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-zinc-100 bg-white p-6">
              <div className="mb-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <v.icon className="h-4 w-4" />
              </div>
              <div className="mb-1.5 text-[14px] font-bold text-zinc-900">{v.title}</div>
              <div className="text-xs leading-relaxed text-zinc-500">{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-purple-900 to-purple-600 px-4 py-20 text-center sm:px-6 lg:px-10">
        <h2 className="mx-auto mb-3.5 max-w-md text-xl font-extrabold text-white sm:text-2xl">আপনার ব্যবসার জন্যও কাজ করুক</h2>
        <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[13.5px] font-bold text-purple-700 hover:bg-purple-50">
          ফ্রি ট্রায়াল শুরু করুন
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
