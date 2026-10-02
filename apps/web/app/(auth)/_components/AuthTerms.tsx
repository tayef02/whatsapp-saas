"use client";

import Link from "next/link";
import { useAuthT } from "./AuthShell";

// "চালিয়ে গেলে আপনি আমাদের শর্তাবলী ও গোপনীয়তা নীতি মেনে নিচ্ছেন" — লগইন ও সাইনআপ দুই পেজে এক
export default function AuthTerms() {
  const t = useAuthT();
  return (
    <p className="mt-4 text-center text-xs text-zinc-500">
      {t.termsPrefix}{" "}
      <Link href="/terms" className="underline hover:text-zinc-700">
        {t.terms}
      </Link>{" "}
      {t.and}{" "}
      <Link href="/privacy" className="underline hover:text-zinc-700">
        {t.privacy}
      </Link>
      {t.termsSuffix}
    </p>
  );
}
