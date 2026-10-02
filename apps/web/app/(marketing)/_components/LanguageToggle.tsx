"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, type Lang } from "../_lib/lang";

// EN | বাং — কুকি সেট করে router.refresh(): সার্ভার কম্পোনেন্টগুলো নতুন ভাষায় আবার রেন্ডার হয়,
// পেজ রিলোড বা URL বদল লাগে না (একই URL, তাই সার্চ ইঞ্জিনে ডুপ্লিকেট পেজ হয় না)
export default function LanguageToggle({ lang, label, large = false }: { lang: Lang; label: string; large?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-[12px] font-bold transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      {(["en", "bn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          className={`${large ? "h-10 min-w-[48px]" : "h-8 min-w-[40px]"} rounded-full px-3 transition-colors ${
            lang === l ? "bg-purple-600 text-white" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {l === "en" ? "EN" : "বাং"}
        </button>
      ))}
    </div>
  );
}
