"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, Loader2 } from "lucide-react";
import AuthBrand from "../_components/AuthBrand";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <AuthBrand />
        </div>

        {done ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MailCheck className="h-6 w-6" />
              </div>
            </div>
            <h1 className="mb-2 text-base font-semibold text-zinc-900">ইমেইল চেক করুন</h1>
            <p className="mb-4 text-sm text-zinc-500">
              ইমেইলটা আমাদের সিস্টেমে থাকলে একটা পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে নতুন পাসওয়ার্ড
              বসান।
            </p>
            <Link href="/login" className="text-sm font-medium text-purple-700 hover:underline">
              লগইন পেজে ফিরুন
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="mb-1 text-base font-semibold text-zinc-900">পাসওয়ার্ড ভুলে গেছেন?</h1>
            <p className="mb-4 text-sm text-zinc-500">আপনার ইমেইল দিন, একটা রিসেট লিংক পাঠিয়ে দিচ্ছি।</p>
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <form action={handleSubmit} className="flex flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-900">ইমেইল</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-zinc-500">
              মনে পড়েছে?{" "}
              <Link href="/login" className="font-medium text-purple-700 hover:underline">
                লগইন করুন
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
