import Link from "next/link";

export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-6 text-sm text-text">
      <div>
        <h1 className="text-xl font-semibold text-text">গোপনীয়তা নীতি</h1>
        <p className="mt-1 text-xs text-text-muted">সর্বশেষ আপডেট: আপনার লাইভ হওয়ার তারিখ বসান</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">১. কী তথ্য সংগ্রহ করি</h2>
        <p className="font-medium text-text">অ্যাকাউন্ট তথ্য:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>আপনার নাম, ইমেইল, পাসওয়ার্ড (এনক্রিপ্টেড)</li>
          <li>পেমেন্ট/বিলিং তথ্য (bKash/Nagad ট্রানজ্যাকশন আইডি)</li>
        </ul>
        <p className="mt-2 font-medium text-text">আপনার ব্যবসার কাস্টমার-সম্পর্কিত তথ্য (WhatsApp ও Messenger দুই চ্যানেল থেকেই):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>কাস্টমারের নাম, ফোন নাম্বার (WhatsApp) বা পেজ-স্কোপড আইডি (Messenger)</li>
          <li>আপনার ও কাস্টমারের মধ্যে আদান-প্রদান হওয়া মেসেজের টেক্সট</li>
          <li>পাঠানো/পাওয়া ছবি, ডকুমেন্ট, অডিও, ভিডিও (মিডিয়া ফাইল)</li>
          <li>অর্ডার-সম্পর্কিত তথ্য (পণ্যের নাম, পরিমাণ, ডেলিভারি ঠিকানা) যদি আপনার চ্যাটবট কথোপকথনে এটা সংগ্রহ করে</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">২. কীভাবে ব্যবহার করি</h2>
        <p>
          এই তথ্য শুধু আপনার হয়ে সেবা দিতে ব্যবহার হয় — ক্যাম্পেইন পাঠানো, AI চ্যাটবট দিয়ে কাস্টমারের প্রশ্নের উত্তর
          দেওয়া, অর্ডার ট্র্যাক করা, ডেলিভারি রিপোর্ট দেখানো। আমরা এই ডেটা বিক্রি করি না বা বিজ্ঞাপনের জন্য ব্যবহার করি
          না।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৩. কতদিন রাখি</h2>
        <p>
          অ্যাকাউন্ট চালু থাকা পর্যন্ত ডেটা সংরক্ষিত থাকে। পুরনো মেসেজ/লগ নিয়মিত আর্কাইভ করা হয় (৯০ দিন পর)। অ্যাকাউন্ট
          বন্ধ করার অনুরোধ করলে যুক্তিসঙ্গত সময়ের মধ্যে ডেটা মুছে ফেলা হয় (নিচে &quot;ডেটা মোছার অনুরোধ&quot; দেখুন)।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৪. তৃতীয় পক্ষের সেবা</h2>
        <p>সেবা দিতে নিচের তৃতীয়-পক্ষের সাথে প্রয়োজনীয় ডেটা শেয়ার হয়:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Meta (WhatsApp/Messenger)</strong> — মেসেজ পাঠানো/পাওয়ার জন্য, তাদের নিজস্ব গোপনীয়তা নীতি প্রযোজ্য</li>
          <li><strong>Supabase</strong> — ডাটাবেস ও ফাইল স্টোরেজ হোস্টিং</li>
          <li><strong>OpenAI/Gemini</strong> — আপনি যদি AI চ্যাটবট চালু করেন, কাস্টমারের প্রশ্ন (ও আপনার নলেজ বেস ডকুমেন্ট) এই প্রোভাইডারকে পাঠানো হয় উত্তর জেনারেট করতে (আপনার নিজের API key দিয়ে)</li>
          <li><strong>bKash/Nagad</strong> — পেমেন্ট ভেরিফিকেশনের জন্য</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৫. নিরাপত্তা</h2>
        <p>
          পাসওয়ার্ড/API key এনক্রিপ্টেড রাখা হয় (Supabase Vault), ডাটাবেস row-level security দিয়ে প্রতিটা ব্যবসা শুধু
          নিজের ডেটা দেখতে পারে — একটা ব্যবসার কাস্টমার-তথ্য আরেকটা ব্যবসা কখনো দেখতে পারবে না।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৬. ডেটা মোছার অনুরোধ</h2>
        <p>
          নিজের অ্যাকাউন্টের বা কোনো কাস্টমারের ডেটা মুছে ফেলার অনুরোধ করতে{" "}
          <Link href="/data-deletion" className="font-medium text-primary hover:underline">
            ডেটা মোছার পেজ
          </Link>{" "}
          দেখুন।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৭. যোগাযোগ</h2>
        <p>গোপনীয়তা নিয়ে প্রশ্ন থাকলে সাইডবারের &quot;সহায়তা&quot; লিংক বা সাপোর্ট ইমেইলে যোগাযোগ করুন।</p>
      </section>

      <div className="rounded-lg bg-warning-light px-4 py-3 text-xs text-warning">
        এটা একটা সাধারণ SaaS টেমপ্লেট, আইনি পরামর্শ না — লাইভ হওয়ার আগে একজন আইনজীবী দিয়ে যাচাই করিয়ে নেওয়া উচিত
        (বিশেষ করে বাংলাদেশের ডেটা সুরক্ষা আইন অনুযায়ী)।
      </div>
    </article>
  );
}
