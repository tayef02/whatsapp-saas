import Link from "next/link";
import type { Metadata } from "next";
import FaqAccordion from "./FaqAccordion";

export const metadata: Metadata = {
  title: "প্রশ্নোত্তর",
  description: "নাম্বার ব্যান, AI বট, পেমেন্ট, Messenger — Gen Z CRM নিয়ে সাধারণ প্রশ্নের উত্তর।",
};

const faqs = [
  {
    q: "আমার WhatsApp নাম্বার ব্যান হবে না তো?",
    a: "প্রতি নাম্বারে দৈনিক সর্বোচ্চ সীমা, নতুন নাম্বারে ওয়ার্ম-আপ মোড (ধীরে ধীরে লিমিট বাড়ে), আর মেসেজের মাঝে র‍্যান্ডম ডিলে — এই তিনটা মিলিয়ে ব্যানের ঝুঁকি অনেক কমে যায়। তবে ১০০% নিশ্চয়তা কেউ দিতে পারে না, এটা WhatsApp-এর নিজস্ব নীতির উপর নির্ভর করে।",
  },
  {
    q: "কোন নাম্বার দিয়ে কানেক্ট করবো?",
    a: "যেকোনো সচল WhatsApp নাম্বার দিয়ে QR স্ক্যান করে কানেক্ট করা যায়। Business App বা সাধারণ WhatsApp — দুটোই চলবে।",
  },
  {
    q: "AI বট কীভাবে উত্তর দেয়?",
    a: "আপনার দেওয়া নলেজ বেস (PDF/Excel/CSV) আর সিস্টেম প্রম্পট থেকেই উত্তর তৈরি হয় — কোনো আগে থেকে লেখা হার্ডকোড করা উত্তর নেই। না বুঝলে মানুষ এজেন্টের কাছে হ্যান্ডঅফ করে।",
  },
  {
    q: "একসাথে কয়টা নাম্বার চালানো যাবে?",
    a: "প্ল্যান অনুযায়ী ভিন্ন — মূল্য পেজে প্রতিটা প্ল্যানের নাম্বার-সীমা দেখা যাবে।",
  },
  {
    q: "Messenger কবে আসবে?",
    a: "Messenger চ্যানেল (কমেন্ট অটোমেশন, পোস্ট শিডিউলার সহ) এখন টেস্টিং পর্যায়ে আছে, শীঘ্রই চালু হবে।",
  },
  {
    q: "পেমেন্ট কীভাবে করবো?",
    a: "bKash বা Nagad দিয়ে ম্যানুয়ালি — কোনো ইন্টারন্যাশনাল কার্ড লাগবে না।",
  },
  {
    q: "ফ্রি ট্রায়ালে কী কী পাবো?",
    a: "৭ দিনের জন্য ফিচার ব্যবহার করতে পারবেন, কোনো কার্ড তথ্য ছাড়াই। মেয়াদ শেষে চাইলে একটা প্ল্যান বেছে নেবেন।",
  },
  {
    q: "কাস্টমারের ডেটা কি নিরাপদ?",
    a: "প্রতিটা workspace-এর ডেটা আলাদা ও সুরক্ষিত (row-level security) — অন্য কোনো ব্যবসার সাথে কখনো মেশে না।",
  },
  {
    q: "টেকনিক্যাল জ্ঞান ছাড়া ব্যবহার করতে পারবো?",
    a: "হ্যাঁ — পুরো ইন্টারফেস বাংলায়, কোনো কোডিং বা জটিল সেটআপ লাগে না।",
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="px-4 pt-16 pb-10 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">প্রশ্নোত্তর</div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-zinc-900 sm:text-[34px]">সাধারণ কিছু প্রশ্ন</h1>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6 lg:px-10">
        <FaqAccordion items={faqs} />

        <div className="mt-9 rounded-2xl bg-purple-50/40 p-7 text-center">
          <div className="mb-1.5 text-[13.5px] font-bold text-zinc-900">উত্তর পাননি?</div>
          <Link href="/contact" className="text-sm font-bold text-purple-600 hover:underline">
            আমাদের সাথে যোগাযোগ করুন →
          </Link>
        </div>
      </section>
    </>
  );
}
