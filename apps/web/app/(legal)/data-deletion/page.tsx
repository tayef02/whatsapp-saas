export default function DataDeletionPage() {
  return (
    <article className="flex flex-col gap-6 text-sm text-text">
      <div>
        <h1 className="text-xl font-semibold text-text">ডেটা মোছার নির্দেশনা</h1>
        <p className="mt-1 text-xs text-text-muted">সর্বশেষ আপডেট: আপনার লাইভ হওয়ার তারিখ বসান</p>
      </div>

      <section className="flex flex-col gap-2">
        <p>
          এই পেজটা Meta (Facebook) এর &quot;Data Deletion Instructions&quot; নীতির জন্য — Messenger Login for
          Business দিয়ে আমাদের অ্যাপে কানেক্ট করা যেকোনো ইউজার (পেজ অ্যাডমিন বা কাস্টমার) এখান থেকে তাদের ডেটা মোছার
          অনুরোধ করতে পারেন।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">কী ডেটা মোছা হবে</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>আপনার Facebook পেজের সাথে সংযুক্ত Page Access Token (তাৎক্ষণিকভাবে)</li>
          <li>সেই পেজের মাধ্যমে হওয়া সব কথোপকথন, মেসেজ ও মিডিয়া ফাইল</li>
          <li>কাস্টমার প্রোফাইলের সংরক্ষিত নাম/PSID</li>
          <li>সেই পেজের মাধ্যমে তৈরি হওয়া অর্ডার রেকর্ড (অনুরোধে উল্লেখ থাকলে)</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">কীভাবে অনুরোধ করবেন</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>পেজ অ্যাডমিন (ব্যবসার মালিক):</strong> ড্যাশবোর্ডে লগইন করে Messenger পেজ কানেক্ট পেজ থেকে
            &quot;ডিসকানেক্ট&quot; চাপলে টোকেন সাথে সাথে মুছে যায়। সব ডেটা সম্পূর্ণ মুছে ফেলতে চাইলে নিচের ইমেইলে
            অনুরোধ পাঠান — পেজের নাম/আইডি জানিয়ে দিন।
          </li>
          <li>
            <strong>কাস্টমার (যিনি কোনো পেজে মেসেজ করেছেন):</strong> নিচের ইমেইলে অনুরোধ পাঠান, কোন পেজে মেসেজ করেছেন
            আর আপনার Facebook নাম/প্রোফাইল লিংক জানিয়ে দিন, যাতে আমরা সঠিক রেকর্ড খুঁজে মুছে ফেলতে পারি।
          </li>
        </ol>
        <p className="mt-2">
          অনুরোধ পাওয়ার পর যুক্তিসঙ্গত সময়ের মধ্যে (সাধারণত কয়েক কার্যদিবস) ডেটা মুছে ফেলা হবে, আর নিশ্চিতকরণ ইমেইল
          পাঠানো হবে।
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-text">যোগাযোগ</h2>
        <p>ডেটা মোছার অনুরোধ পাঠাতে: আপনার সাপোর্ট ইমেইল এখানে বসান (যেমন support@yourdomain.com)</p>
      </section>

      <div className="rounded-lg bg-warning-light px-4 py-3 text-xs text-warning">
        এটা একটা সাধারণ টেমপ্লেট — লাইভ হওয়ার আগে একজন আইনজীবী দিয়ে যাচাই করিয়ে নেওয়া উচিত, আর Meta App Dashboard এ
        &quot;Data Deletion Instructions URL&quot; ফিল্ডে এই পেজের লাইভ লিংক বসাতে হবে।
      </div>
    </article>
  );
}
