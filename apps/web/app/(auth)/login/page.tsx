"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthBrand from "../_components/AuthBrand";
import { login } from "../actions";

// Supabase এর রাগরাগে এরর মেসেজ — ব্যবহারকারীকে বাংলায় স্পষ্ট করে দেখানোর জন্য ম্যাপ করা।
// login() সার্ভার অ্যাকশন অপরিবর্তিত, শুধু এখানে ডিসপ্লে করার আগে টেক্সট বদলানো হচ্ছে।
function translateAuthError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    setLoading(false);

    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
    // আগে "/" এ পাঠানো হতো, যেটা নিজে থেকেই /dashboard এ রিডাইরেক্ট করত — এখন "/" পাবলিক
    // মার্কেটিং হোমপেজ (Gen Z CRM), তাই সরাসরি /dashboard এ পাঠানো হচ্ছে। workspace/onboarding
    // লাগলে dashboard/layout.tsx নিজেই /onboarding এ পাঠিয়ে দেয় — আচরণ অপরিবর্তিত।
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <AuthBrand />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-base font-semibold text-zinc-900">লগইন করুন</h1>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <form action={handleSubmit} className="flex flex-col gap-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-900">ইমেইল</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              />
            </label>

            <label className="block text-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-medium text-zinc-900">পাসওয়ার্ড</span>
                <Link href="/forgot-password" className="text-xs font-medium text-purple-700 hover:underline">
                  পাসওয়ার্ড ভুলে গেছেন?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "লগইন হচ্ছে..." : "লগইন"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-500">
            অ্যাকাউন্ট নেই?{" "}
            <Link href="/signup" className="font-medium text-purple-700 hover:underline">
              সাইনআপ করুন
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          লগইন করলে আপনি আমাদের{" "}
          <Link href="/terms" className="underline hover:text-zinc-700">
            শর্তাবলী
          </Link>{" "}
          ও{" "}
          <Link href="/privacy" className="underline hover:text-zinc-700">
            গোপনীয়তা নীতি
          </Link>{" "}
          মেনে নিচ্ছেন।
        </p>
      </div>
    </div>
  );
}
