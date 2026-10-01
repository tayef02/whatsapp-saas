export default function TermsPage() {
  return (
    <article className="flex flex-col gap-6 text-sm text-text">
      <div>
        <h1 className="text-xl font-semibold text-text">ব্যবহারের শর্তাবলী</h1>
        <p className="mt-1 text-xs text-text-muted">সর্বশেষ আপডেট: আপনার লাইভ হওয়ার তারিখ বসান</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">১. সেবার বর্ণনা</h2>
        <p>
          এই প্ল্যাটফর্ম (&quot;আমরা&quot;, &quot;সেবা&quot;) WhatsApp ও Facebook Messenger এর মাধ্যমে ব্যবসার মার্কেটিং,
          কাস্টমার সাপোর্ট ও অর্ডার ম্যানেজমেন্ট করতে সাহায্য করে — ক্যাম্পেইন পাঠানো, AI চ্যাটবট দিয়ে কাস্টমারের
          প্রশ্নের উত্তর দেওয়া, কন্টাক্ট/অর্ডার ম্যানেজ করা ইত্যাদি।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">২. অ্যাকাউন্ট</h2>
        <p>
          একটা অ্যাকাউন্ট খুলতে সঠিক তথ্য (ইমেইল, নাম) দিতে হবে। আপনার অ্যাকাউন্টের পাসওয়ার্ড/অ্যাক্সেসের নিরাপত্তার
          দায়িত্ব আপনার। সন্দেহজনক অ্যাক্টিভিটি দেখলে সাথে সাথে আমাদের জানান।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৩. মূল্য ও পেমেন্ট</h2>
        <p>
          সেবা বিভিন্ন প্ল্যানে পাওয়া যায় (মেসেজ লিমিট অনুযায়ী), বিলিং পেজে বিস্তারিত দেখা যাবে। পেমেন্ট bKash/Nagad এর
          মাধ্যমে ম্যানুয়ালি ভেরিফাই করা হয় — পেমেন্টের তথ্য ভুল/অসম্পূর্ণ দিলে প্ল্যান অ্যাক্টিভ হতে দেরি হতে পারে।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৪. গ্রহণযোগ্য ব্যবহার</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>WhatsApp ও Meta/Facebook এর নিজস্ব ব্যবহারের নীতি (Terms of Service, Business Messaging Policy) মেনে চলতে হবে — এগুলো ভঙ্গ করলে আপনার নাম্বার/পেজ Meta নিজেই ব্যান/সীমাবদ্ধ করে দিতে পারে, যেটার জন্য আমরা দায়ী না।</li>
          <li>অযাচিত স্প্যাম মেসেজ পাঠানো, কাস্টমারের &quot;STOP&quot;/&quot;বন্ধ&quot; অনুরোধ উপেক্ষা করা নিষিদ্ধ।</li>
          <li>অবৈধ, প্রতারণামূলক বা ক্ষতিকর কনটেন্ট পাঠাতে এই প্ল্যাটফর্ম ব্যবহার করা যাবে না।</li>
          <li>নিয়ম ভঙ্গ করলে কোনো নোটিশ ছাড়াই অ্যাকাউন্ট সাময়িক/স্থায়ীভাবে বন্ধ করে দেওয়া হতে পারে।</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৫. দায় সীমাবদ্ধতা</h2>
        <p>
          সেবা &quot;যেমন আছে&quot; ভিত্তিতে দেওয়া হয়। WhatsApp/Messenger এর নিজস্ব ডাউনটাইম, নীতি পরিবর্তন বা নাম্বার/পেজ
          ব্যান হওয়ার জন্য আমরা দায়ী না — এগুলো Meta এর নিয়ন্ত্রণে। ব্যবসায়িক সিদ্ধান্তের (ক্যাম্পেইন পাঠানো, AI এর
          উত্তর) দায়িত্ব আপনার, আমরা শুধু টুল সরবরাহ করি।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৬. পরিবর্তন</h2>
        <p>এই শর্তাবলী সময়ে সময়ে আপডেট হতে পারে — বড় পরিবর্তন হলে ইমেইল/ড্যাশবোর্ড নোটিফিকেশনে জানানো হবে।</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">৭. যোগাযোগ</h2>
        <p>প্রশ্ন থাকলে সাইডবারের &quot;সহায়তা&quot; লিংক বা সাপোর্ট ইমেইলে যোগাযোগ করুন।</p>
      </section>

      <div className="rounded-lg bg-warning-light px-4 py-3 text-xs text-warning">
        এটা একটা সাধারণ SaaS টেমপ্লেট, আইনি পরামর্শ না — লাইভ হওয়ার আগে একজন আইনজীবী দিয়ে যাচাই করিয়ে নেওয়া উচিত
        (বিশেষ করে বাংলাদেশের প্রাসঙ্গিক আইন/ভোক্তা অধিকার অনুযায়ী)।
      </div>
    </article>
  );
}
