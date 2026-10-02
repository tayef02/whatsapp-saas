"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthT } from "./AuthShell";

type Provider = "google" | "facebook" | "linkedin";

// Supabase এর provider নাম — LinkedIn এর জন্য বর্তমান সমর্থিত ও OpenID Connect ভিত্তিক "linkedin_oidc"
const SUPABASE_PROVIDER: Record<Provider, "google" | "facebook" | "linkedin_oidc"> = {
  google: "google",
  facebook: "facebook",
  linkedin: "linkedin_oidc",
};

// কোন বাটন দেখানো হবে — NEXT_PUBLIC_SOCIAL_LOGIN (কমা দিয়ে, build-time এ বসে)। সেট না থাকলে তিনটাই।
// খালি স্ট্রিং দিলে কোনো বাটন দেখাবে না (Supabase এ provider সেটআপ না হওয়া পর্যন্ত লুকানোর জন্য)।
const ENABLED = (process.env.NEXT_PUBLIC_SOCIAL_LOGIN ?? "google,facebook,linkedin")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is Provider => p === "google" || p === "facebook" || p === "linkedin");

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 10-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0024 12z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#0A66C2"
        d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"
      />
    </svg>
  );
}

const ICONS: Record<Provider, () => React.ReactElement> = { google: GoogleIcon, facebook: FacebookIcon, linkedin: LinkedInIcon };

// Google / Facebook / LinkedIn দিয়ে সাইন-ইন — সরাসরি Supabase OAuth (নতুন কোনো প্যাকেজ নেই)। ব্রাউজার
// প্রোভাইডারে যায়, ফিরে আসে /auth/callback এ (সেখানে code → session)। লগইন ও সাইনআপ দুই পেজেই
// একই বাটন — নতুন ইউজার হলে Supabase অ্যাকাউন্ট বানায়, তারপর dashboard/layout.tsx workspace না থাকলে
// /onboarding এ পাঠায়।
export default function SocialLogin() {
  const t = useAuthT();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (ENABLED.length === 0) return null;

  async function start(provider: Provider) {
    setBusy(provider);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: SUPABASE_PROVIDER[provider],
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // সফল হলে ব্রাউজার ইতিমধ্যে প্রোভাইডারে চলে যায় — এখানে শুধু ব্যর্থ হলে ফেরা হয়
    if (oauthError) {
      console.error(`[social-login] ${provider} শুরু করা যায়নি: ${oauthError.message}`);
      setError(t.socialError.replace("{provider}", t.social[provider]));
      setBusy(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        {t.or}
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ENABLED.length}, minmax(0, 1fr))` }}>
        {ENABLED.map((p) => {
          const Icon = ICONS[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => start(p)}
              disabled={busy !== null}
              aria-label={t.social[p]}
              title={t.social[p]}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon />
              <span className="hidden sm:inline">{t.social[p]}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
