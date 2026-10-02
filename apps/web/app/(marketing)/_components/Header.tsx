"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import LanguageToggle from "./LanguageToggle";
import type { Content } from "../_lib/content";
import type { Lang } from "../_lib/lang";

// মার্কেটিং সাইটের নিজস্ব হেডার — ড্যাশবোর্ডের Sidebar থেকে সম্পূর্ণ আলাদা কম্পোনেন্ট, ইচ্ছাকৃতভাবে
// Tailwind-এর stock purple-* প্যালেট ব্যবহার করে (ড্যাশবোর্ডের কাস্টম টোকেনের সাথে সংঘর্ষ এড়াতে)।
// সব লেখা `nav` prop থেকে আসে (সার্ভারে ভাষা অনুযায়ী বাছা) — এখানে কোনো হার্ডকোড টেক্সট নেই
export default function Header({ isLoggedIn, lang, nav }: { isLoggedIn: boolean; lang: Lang; nav: Content["nav"] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/features", label: nav.features },
    { href: "/pricing", label: nav.pricing },
    { href: "/contact", label: nav.support },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <LogoMark size={30} />
            <span className="text-[17px] font-extrabold tracking-tight text-zinc-900">Gen Z CRM</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className={`flex items-center gap-1 text-[13.5px] font-semibold ${menuOpen ? "text-purple-700" : "text-zinc-600 hover:text-zinc-900"}`}
              >
                {nav.solutions}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <button aria-label={nav.closeMenu} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                  <div className="absolute top-10 left-0 z-20 flex w-[620px] overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl">
                    <div className="flex w-[190px] flex-col gap-0.5 border-r border-zinc-100 bg-purple-50/40 p-2.5">
                      <div className="flex items-center justify-between rounded-lg bg-purple-100 px-3 py-2.5 text-[13px] font-bold text-purple-700">
                        {nav.whatsapp}
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{nav.live}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-semibold text-zinc-400">
                        {nav.messenger}
                        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">{nav.soon}</span>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 p-5">
                      {nav.mega.map((item) => (
                        <Link key={item} href="/features" onClick={() => setMenuOpen(false)} className="text-[13px] font-medium text-zinc-700 hover:text-purple-700">
                          {item}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-[13.5px] font-semibold text-zinc-600 hover:text-zinc-900">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageToggle lang={lang} label={nav.language} />
          {isLoggedIn ? (
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-purple-700">
              {nav.dashboard}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-[13.5px] font-semibold text-zinc-600 hover:text-zinc-900">
                {nav.login}
              </Link>
              <Link href="/signup" className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-purple-700">
                {nav.start}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle lang={lang} label={nav.language} />
          <button aria-label={nav.menu} onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center">
            <Menu className="h-6 w-6 text-zinc-900" />
          </button>
        </div>
      </div>

      {/* মোবাইল ড্রয়ার */}
      {mobileOpen && (
        <>
          <button aria-label={nav.closeMenu} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />
          <div className="fixed top-0 right-0 bottom-0 z-40 flex w-[82%] max-w-[300px] flex-col gap-1 overflow-y-auto bg-white p-4 shadow-2xl lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <LanguageToggle lang={lang} label={nav.language} large />
              <button aria-label={nav.closeMenu} onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>
            <div className="px-2.5 py-1.5 text-[10.5px] font-bold text-zinc-400">{nav.solutions}</div>
            <div className="flex items-center justify-between rounded-lg bg-purple-100 px-2.5 py-2.5 text-sm font-bold text-purple-700">
              {nav.whatsapp}
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{nav.live}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2.5 text-sm font-semibold text-zinc-400">
              {nav.messenger}
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">{nav.soon}</span>
            </div>
            <div className="my-2 h-px bg-zinc-100" />
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-2.5 py-3 text-sm font-semibold text-zinc-700">
                {l.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="mt-3 rounded-lg bg-purple-600 px-4 py-3 text-center text-[13.5px] font-bold text-white">
                {nav.dashboard}
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-2.5 py-3 text-sm font-semibold text-zinc-700">
                  {nav.login}
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="mt-2 rounded-lg bg-purple-600 px-4 py-3 text-center text-[13.5px] font-bold text-white">
                  {nav.start}
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
