"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, ChevronDown, Menu, X, ArrowRight } from "lucide-react";

// মার্কেটিং সাইটের নিজস্ব হেডার — ড্যাশবোর্ডের Sidebar/Header থেকে সম্পূর্ণ আলাদা কম্পোনেন্ট,
// ইচ্ছাকৃতভাবে Tailwind-এর stock purple-* প্যালেট ব্যবহার করে (ড্যাশবোর্ডের কাস্টম bg-primary
// ইত্যাদি টোকেন সবুজের সাথে বাঁধা — এখানে সেগুলো ব্যবহার করলে দুই জায়গার থিম মিশে যেত)
const navLinks = [
  { href: "/features", label: "ফিচার" },
  { href: "/pricing", label: "মূল্য" },
  { href: "/contact", label: "সহায়তা" },
];

export default function Header({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-400 to-purple-700">
              <MessageCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-extrabold tracking-tight text-zinc-900">Gen Z CRM</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`flex items-center gap-1 text-[13.5px] font-semibold ${menuOpen ? "text-purple-700" : "text-zinc-600 hover:text-zinc-900"}`}
              >
                সমাধান
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <button aria-label="মেনু বন্ধ করুন" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                  <div className="absolute top-10 left-0 z-20 flex w-[620px] overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl">
                    <div className="flex w-[190px] flex-col gap-0.5 border-r border-zinc-100 bg-purple-50/40 p-2.5">
                      <div className="flex items-center justify-between rounded-lg bg-purple-100 px-3 py-2.5 text-[13px] font-bold text-purple-700">
                        হোয়াটসঅ্যাপ
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">লাইভ</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-semibold text-zinc-400">
                        মেসেঞ্জার
                        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">শীঘ্রই</span>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 p-5">
                      {[
                        "AI চ্যাটবট",
                        "ক্যাম্পেইন",
                        "কন্টাক্ট ও টেমপ্লেট",
                        "গ্রুপ অটোমেশন",
                        "অর্ডার ম্যানেজমেন্ট",
                        "ইনবক্স",
                        "নাম্বার ওয়ার্ম-আপ",
                        "ডেলিভারি রিপোর্ট",
                      ].map((item) => (
                        <Link
                          key={item}
                          href="/features"
                          onClick={() => setMenuOpen(false)}
                          className="text-[13px] font-medium text-zinc-700 hover:text-purple-700"
                        >
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

        <div className="hidden items-center gap-5 lg:flex">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-purple-700"
            >
              ড্যাশবোর্ডে যান
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-[13.5px] font-semibold text-zinc-600 hover:text-zinc-900">
                লগইন
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-purple-700"
              >
                ফ্রি শুরু করুন
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        <button aria-label="মেনু" onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center lg:hidden">
          <Menu className="h-6 w-6 text-zinc-900" />
        </button>
      </div>

      {/* মোবাইল ড্রয়ার */}
      {mobileOpen && (
        <>
          <button aria-label="মেনু বন্ধ করুন" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />
          <div className="fixed top-0 right-0 bottom-0 z-40 flex w-[82%] max-w-[300px] flex-col gap-1 bg-white p-4 shadow-2xl lg:hidden">
            <div className="mb-2 flex justify-end">
              <button aria-label="বন্ধ করুন" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>
            <div className="px-2.5 py-1.5 text-[10.5px] font-bold text-zinc-400">সমাধান</div>
            <div className="flex items-center justify-between rounded-lg bg-purple-100 px-2.5 py-2.5 text-sm font-bold text-purple-700">
              WhatsApp
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">লাইভ</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2.5 text-sm font-semibold text-zinc-400">
              Messenger
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">শীঘ্রই</span>
            </div>
            <div className="my-2 h-px bg-zinc-100" />
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2.5 py-2.5 text-sm font-semibold text-zinc-700"
              >
                {l.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="mt-3 rounded-lg bg-purple-600 px-4 py-3 text-center text-[13.5px] font-bold text-white"
              >
                ড্যাশবোর্ডে যান
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2.5 py-2.5 text-sm font-semibold text-zinc-700"
                >
                  লগইন
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-lg bg-purple-600 px-4 py-3 text-center text-[13.5px] font-bold text-white"
                >
                  ফ্রি শুরু করুন
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
