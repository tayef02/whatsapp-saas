"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, MailCheck, Loader2 } from "lucide-react";
import AuthBrand from "../_components/AuthBrand";
import AuthTerms from "../_components/AuthTerms";
import SocialLogin from "../_components/SocialLogin";
import { useAuthT } from "../_components/AuthShell";
import { signup } from "../actions";

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600";

export default function SignupPage() {
  const t = useAuthT();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
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
            <h1 className="mb-2 text-base font-semibold text-zinc-900">{t.signup.doneTitle}</h1>
            <p className="mb-4 text-sm text-zinc-500">{t.signup.doneBody}</p>
            <Link href="/login" className="text-sm font-medium text-purple-700 hover:underline">
              {t.signup.doneLink}
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-base font-semibold text-zinc-900">{t.signup.title}</h1>
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <form action={handleSubmit} className="flex flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-900">{t.signup.name}</span>
                <input id="fullName" name="fullName" type="text" required className={inputClass} />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-900">{t.signup.email}</span>
                <input id="email" name="email" type="email" required className={inputClass} />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-900">{t.signup.password}</span>
                <div className="relative">
                  <input id="password" name="password" type={showPassword ? "text" : "password"} minLength={6} required className={`${inputClass} pr-10`} />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="mt-1 block text-xs text-zinc-500">{t.signup.hint}</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t.signup.submitting : t.signup.submit}
              </button>
            </form>

            <SocialLogin />

            <p className="mt-4 text-center text-sm text-zinc-500">
              {t.signup.haveAccount}{" "}
              <Link href="/login" className="font-medium text-purple-700 hover:underline">
                {t.signup.loginLink}
              </Link>
            </p>
          </div>
        )}

        {!done && <AuthTerms />}
      </div>
    </div>
  );
}
