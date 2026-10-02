"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import AuthBrand from "../_components/AuthBrand";
import { useAuthT } from "../_components/AuthShell";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600";

// Supabase এর রিসেট লিংকে #access_token=...&type=recovery হ্যাশ থাকে — URL fragment কখনো
// সার্ভারে যায় না, তাই এই পেজ অবশ্যই client-side হবে আর middleware এ পাবলিক রুট হতে হবে
// (নাহলে unauthenticated রিকোয়েস্ট হিসেবে /login এ রিডাইরেক্ট হয়ে যেত, হ্যাশ পার্স হওয়ার
// সুযোগই পেত না)। Supabase browser client নিজেই হ্যাশ থেকে একটা অস্থায়ী recovery সেশন বানায়
// (onAuthStateChange এ PASSWORD_RECOVERY ইভেন্ট), আপডেট করা পাসওয়ার্ডও সরাসরি সেই client
// দিয়েই পাঠানো হয় (সার্ভার অ্যাকশন না — cookie sync টাইমিং নিয়ে অনিশ্চয়তা এড়াতে)।
export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useAuthT();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // লিংক ক্লিক করার সাথে সাথে সাধারণত PASSWORD_RECOVERY ইভেন্ট আসে, কিন্তু যদি পেজ রিলোড
    // হয় (হ্যাশ তখনও URL এ আছে) বা ইভেন্ট মিস হয়, getSession() দিয়ে একটা ফলব্যাক চেক —
    // কয়েক সেকেন্ড পরও কোনো সেশন না পেলে ধরে নেওয়া হয় লিংকের মেয়াদ শেষ/অকার্যকর
    const timeout = setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setReady(true);
      else setInvalidLink(true);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit() {
    setError(null);
    if (password.length < 6) return setError(t.reset.tooShort);
    if (password !== confirmPassword) return setError(t.reset.mismatch);

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) return setError(updateError.message);
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <AuthBrand />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
              <h1 className="mb-2 text-base font-semibold text-zinc-900">{t.reset.doneTitle}</h1>
              <button
                onClick={() => router.push("/login")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700"
              >
                {t.reset.doneLink}
              </button>
            </div>
          ) : invalidLink ? (
            <div className="text-center">
              <h1 className="mb-2 text-base font-semibold text-zinc-900">{t.reset.invalidTitle}</h1>
              <p className="mb-4 text-sm text-zinc-500">{t.reset.invalidBody}</p>
              <Link href="/forgot-password" className="text-sm font-medium text-purple-700 hover:underline">
                {t.reset.invalidLink}
              </Link>
            </div>
          ) : !ready ? (
            <p className="py-4 text-center text-sm text-zinc-500">{t.reset.verifying}</p>
          ) : (
            <>
              <h1 className="mb-4 text-base font-semibold text-zinc-900">{t.reset.title}</h1>
              {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex flex-col gap-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-zinc-900">{t.reset.newPassword}</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                      aria-label={showPassword ? t.hidePassword : t.showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-500">{t.reset.hint}</span>
                </label>

                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-zinc-900">{t.reset.confirm}</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </label>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? t.reset.submitting : t.reset.submit}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
