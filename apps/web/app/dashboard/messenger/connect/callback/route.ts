import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const STATE_COOKIE = "messenger_oauth_state";
const PAGES_COOKIE = "messenger_oauth_pages";

// route.ts কোনো layout দিয়ে র‍্যাপড হয় না, তাই messenger/layout.tsx এর ফ্ল্যাগ-গার্ড এখানে প্রযোজ্য না —
// আলাদাভাবে চেক করা হচ্ছে
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_MESSENGER_ENABLED !== "true") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    // ইউজার নিজেই permission দিতে অস্বীকার করলে Facebook এটা পাঠায় — এখানে কোনো
    // secret/token নেই, error কোড/reason লগ করা নিরাপদ
    console.log(`[messenger connect] OAuth বাতিল/ব্যর্থ: ${error}`);
    return NextResponse.redirect(new URL("/dashboard/messenger?error=oauth_denied", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    console.warn("[messenger connect] state মেলেনি বা code নেই, CSRF/মেয়াদ-শেষ কুকি সন্দেহ");
    return NextResponse.redirect(new URL("/dashboard/messenger?error=invalid_state", request.url));
  }

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  const appUrl = process.env.APP_URL;
  if (!appId || !appSecret || !appUrl) {
    return NextResponse.redirect(new URL("/dashboard/messenger?error=not_configured", request.url));
  }

  const provider = new MetaMessengerProvider({ appId, appSecret });
  const redirectUri = `${appUrl}/dashboard/messenger/connect/callback`;

  try {
    const { userAccessToken: shortLived } = await provider.exchangeCodeForUserToken(code, redirectUri);
    const { userAccessToken: longLived } = await provider.getLongLivedUserToken(shortLived);
    const pages = await provider.listPages(longLived);

    if (pages.length === 0) {
      return NextResponse.redirect(new URL("/dashboard/messenger?error=no_pages", request.url));
    }

    // পেজ তালিকা (token সহ) একটা httpOnly কুকিতে অল্প সময়ের জন্য — URL/DB তে না, বাছাই করার
    // পর connectPage() action এটা পড়ে ব্যবহার করবে, সাথে সাথে মুছে ফেলবে (single-use)
    cookieStore.set(PAGES_COOKIE, JSON.stringify(pages), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/dashboard/messenger/connect",
    });

    return NextResponse.redirect(new URL("/dashboard/messenger/connect/select", request.url));
  } catch (err) {
    // err.message এ কখনো token থাকে না (messenger.ts এর safeFetch/parseGraphError দেখুন) —
    // শুধু Graph API এর নিজস্ব error মেসেজ (type/code), যেটা লগ করা নিরাপদ
    console.error("[messenger connect] OAuth এক্সচেঞ্জ/পেজ-লিস্ট ব্যর্থ:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/dashboard/messenger?error=oauth_failed", request.url));
  }
}
