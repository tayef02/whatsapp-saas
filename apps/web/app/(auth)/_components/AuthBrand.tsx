import Link from "next/link";
import LogoMark from "@/components/brand/LogoMark";

// লগইন/সাইনআপ/পাসওয়ার্ড পেজগুলোর উপরের লোগো ব্লক — মার্কেটিং সাইটের Header.tsx এর সাথে একই
// লোগো (CRM নেটওয়ার্ক চিহ্ন, বেগুনি gradient)
export default function AuthBrand() {
  return (
    <Link href="/" className="mb-6 flex flex-col items-center gap-2">
      <LogoMark size={44} />
      <span className="text-lg font-extrabold tracking-tight text-zinc-900">Gen Z CRM</span>
    </Link>
  );
}
