import Link from "next/link";
import { MessageCircle } from "lucide-react";

// লগইন/সাইনআপ/পাসওয়ার্ড পেজগুলোর উপরের লোগো ব্লক — মার্কেটিং সাইটের Header.tsx এর লোগোর
// সাথে মেলানো (Gen Z CRM, বেগুনি gradient), ড্যাশবোর্ডের সবুজ bg-primary টোকেন থেকে আলাদা
export default function AuthBrand() {
  return (
    <Link href="/" className="mb-6 flex flex-col items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-700">
        <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-lg font-extrabold tracking-tight text-zinc-900">Gen Z CRM</span>
    </Link>
  );
}
