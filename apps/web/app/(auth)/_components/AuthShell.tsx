"use client";

import { createContext, useContext } from "react";
import LanguageToggle from "@/app/(marketing)/_components/LanguageToggle";
import type { Lang } from "@/app/(marketing)/_lib/lang";
import { bn, en, type AuthContent } from "../_lib/auth-content";

const AuthTextContext = createContext<AuthContent>(en);

// সার্ভার layout (getLang() দিয়ে কুকি পড়ে) থেকে ভাষা আসে; ক্লায়েন্ট পেজগুলো useAuthT() দিয়ে
// লেখা পায়। উপরে ডানে EN | বাং টগল — মার্কেটিং সাইটের একই কম্পোনেন্ট ও কুকি (পেজ রিফ্রেশ হয়ে
// নতুন ভাষায় আসে, ফর্মের লেখা ইনপুট বদলায় না কারণ রিফ্রেশে ক্লায়েন্ট state অক্ষত থাকে)
export default function AuthShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <AuthTextContext.Provider value={lang === "bn" ? bn : en}>
      <div className="relative">
        <div className="absolute top-4 right-4 z-10">
          <LanguageToggle lang={lang} label={lang === "bn" ? "ভাষা" : "Language"} />
        </div>
        {children}
      </div>
    </AuthTextContext.Provider>
  );
}

export function useAuthT() {
  return useContext(AuthTextContext);
}
