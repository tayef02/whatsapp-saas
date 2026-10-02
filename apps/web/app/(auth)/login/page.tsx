"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
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
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold text-primary">WhatsApp SaaS</span>
        </div>

        <Card>
          <h1 className="mb-4 text-base font-semibold text-text">লগইন করুন</h1>
          {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

          <form action={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              name="email"
              type="email"
              label="ইমেইল"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="block text-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-medium text-text">পাসওয়ার্ড</span>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  পাসওয়ার্ড ভুলে গেছেন?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
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
            </label>

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "লগইন হচ্ছে..." : "লগইন"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-text-muted">
            অ্যাকাউন্ট নেই?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              সাইনআপ করুন
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-text-muted">
          লগইন করলে আপনি আমাদের{" "}
          <Link href="/terms" className="underline hover:text-text">
            শর্তাবলী
          </Link>{" "}
          ও{" "}
          <Link href="/privacy" className="underline hover:text-text">
            গোপনীয়তা নীতি
          </Link>{" "}
          মেনে নিচ্ছেন।
        </p>
      </div>
    </div>
  );
}
