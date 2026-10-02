import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

// ভেতরের পেজগুলোর (ফিচার/মূল্য/...) উপরের গাঢ় বেগুনি breadcrumb ব্যান্ড — apaya-স্টাইল
export default function Breadcrumb({ homeLabel, current }: { homeLabel: string; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="bg-purple-950">
      <ol className="mx-auto flex h-8 max-w-7xl items-center gap-1.5 px-4 text-[11.5px] font-medium text-purple-300 sm:px-6 lg:px-10">
        <li>
          <Link href="/" aria-label={homeLabel} className="flex items-center hover:text-white">
            <Home className="h-3 w-3" />
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3 w-3 text-purple-500" />
        </li>
        <li aria-current="page" className="text-purple-200">
          {current}
        </li>
      </ol>
    </nav>
  );
}
