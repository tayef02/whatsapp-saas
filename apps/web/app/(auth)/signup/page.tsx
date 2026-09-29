"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Eye, EyeOff, MailCheck } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
import { signup } from "../actions";

export default function SignupPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold text-primary">WhatsApp SaaS</span>
        </div>

        {done ? (
          <Card className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
                <MailCheck className="h-6 w-6" />
              </div>
            </div>
            <h1 className="mb-2 text-base font-semibold text-text">ইমেইল চেক করুন</h1>
            <p className="mb-4 text-sm text-text-muted">আপনার ইমেইলে একটা কনফার্মেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে অ্যাকাউন্ট কনফার্ম করুন, তারপর লগইন করুন।</p>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              লগইন পেজে যান
            </Link>
          </Card>
        ) : (
          <Card>
            <h1 className="mb-4 text-base font-semibold text-text">নতুন অ্যাকাউন্ট বানান</h1>
            {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

            <form action={handleSubmit} className="flex flex-col gap-4">
              <Input id="fullName" name="fullName" type="text" label="আপনার নাম" required />
              <Input id="email" name="email" type="email" label="ইমেইল" required />

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-text">পাসওয়ার্ড</span>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-text-muted hover:text-text"
                    aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="mt-1 block text-xs text-text-muted">কমপক্ষে ৬ ক্যারেক্টার</span>
              </label>

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "তৈরি হচ্ছে..." : "সাইনআপ"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-text-muted">
              অ্যাকাউন্ট আছে?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                লগইন করুন
              </Link>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
