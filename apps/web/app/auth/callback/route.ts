import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAppPublicUrl } from "@/lib/public-url";

// Google/Facebook/LinkedIn সাইন-ইনের পর প্রোভাইডার → Supabase → এখানে ফেরে (?code=...)। code কে
// সেশনে বদলে (PKCE) /dashboard এ পাঠানো হয়; workspace না থাকলে dashboard/layout.tsx নিজেই
// /onboarding এ পাঠায়। গন্তব্য সবসময় নির্দিষ্ট (query থেকে নেওয়া হয় না) — open redirect এড়াতে।
// Nginx/Traefik এর পেছনে request.url এর host ভুল হতে পারে, তাই আগে APP_PUBLIC_URL।
export async function GET(request: NextRequest) {
  const target = (path: string) => buildAppPublicUrl(path) ?? new URL(path, request.url).toString();
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target("/dashboard"));
    console.error(`[auth callback] code exchange ব্যর্থ: ${error.message}`);
  }

  return NextResponse.redirect(target("/login?error=oauth"));
}
