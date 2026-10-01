"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Supabase এর রিসেট লিংকে #access_token=...&type=recovery হ্যাশ থাকে — URL fragment কখনো
// সার্ভারে যায় না, তাই এই পেজ অবশ্যই client-side হবে আর middleware এ পাবলিক রুট হতে হবে
// (নাহলে unauthenticated রিকোয়েস্ট হিসেবে /login এ রিডাইরেক্ট হয়ে যেত, হ্যাশ পার্স হওয়ার
// সুযোগই পেত না)। Supabase browser client নিজেই হ্যাশ থেকে একটা অস্থায়ী recovery সেশন বানায়
// (onAuthStateChange এ PASSWORD_RECOVERY ইভেন্ট), আপডেট করা পাসওয়ার্ডও সরাসরি সেই client
// দিয়েই পাঠানো হয় (সার্ভার অ্যাকশন না — cookie sync টাইমিং নিয়ে অনিশ্চয়তা এড়াতে)।
export default function ResetPasswordPage() {
  const router = useRouter();
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
    if (password.length < 6) return setError("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    if (password !== confirmPassword) return setError("দুই পাসওয়ার্ড মিলছে না");

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) return setError(updateError.message);
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

        <Card>
          {done ? (
            <div className="text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
              <h1 className="mb-2 text-base font-semibold text-text">পাসওয়ার্ড বদলানো হয়েছে</h1>
              <Button onClick={() => router.push("/login")} className="w-full">
                লগইন করুন
              </Button>
            </div>
          ) : invalidLink ? (
            <div className="text-center">
              <h1 className="mb-2 text-base font-semibold text-text">লিংকের মেয়াদ শেষ হয়ে গেছে</h1>
              <p className="mb-4 text-sm text-text-muted">এই রিসেট লিংকটা আর কাজ করছে না — আবার একটা নতুন লিংক চেয়ে নিন।</p>
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                আবার চেষ্টা করুন
              </Link>
            </div>
          ) : !ready ? (
            <p className="py-4 text-center text-sm text-text-muted">লিংক যাচাই হচ্ছে...</p>
          ) : (
            <>
              <h1 className="mb-4 text-base font-semibold text-text">নতুন পাসওয়ার্ড দিন</h1>
              {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="flex flex-col gap-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text">নতুন পাসওয়ার্ড</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text">আবার লিখুন</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>

                <Button onClick={handleSubmit} loading={loading} className="w-full">
                  {loading ? "সেভ হচ্ছে..." : "পাসওয়ার্ড সেভ করুন"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
