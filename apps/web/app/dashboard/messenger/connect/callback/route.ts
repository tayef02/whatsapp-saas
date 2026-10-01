import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildPublicUrl } from "@/lib/messenger-url";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const STATE_COOKIE = "messenger_oauth_state";
const PAGES_COOKIE = "messenger_oauth_pages";

const NOT_CONFIGURED_MESSAGE =
  "Messenger সেটআপ হয়নি: MESSENGER_PUBLIC_URL এনভায়রনমেন্ট ভ্যারিয়েবল সেট করা নেই বা https:// দিয়ে শুরু হচ্ছে না।";

// route.ts কোনো layout দিয়ে র‍্যাপড হয় না, তাই messenger/layout.tsx এর ফ্ল্যাগ-গার্ড এখানে প্রযোজ্য না —
// আলাদাভাবে চেক করা হচ্ছে। এই রুটের প্রতিটা redirect (সফল ও ব্যর্থ) MESSENGER_PUBLIC_URL থেকে
// বানানো হয়, request.url থেকে না — VPS এ Nginx/Docker এর পেছনে request.url এ ভুল host/protocol
// আসতে পারে (এটাই আগে একবার Facebook এর OAuth redirect_uri ভেঙে দিয়েছিল)
export async function GET(request: NextRequest) {
  const notConfiguredUrl = buildPublicUrl("/dashboard/messenger?error=not_configured");
  if (!notConfiguredUrl) {
    return new NextResponse(NOT_CONFIGURED_MESSAGE, { status: 500 });
  }

  if (process.env.NEXT_PUBLIC_MESSENGER_ENABLED !== "true") {
    return NextResponse.redirect(buildPublicUrl("/dashboard")!);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(buildPublicUrl("/login")!);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    // ইউজার নিজেই permission দিতে অস্বীকার করলে Facebook এটা পাঠায় — এখানে কোনো
    // secret/token নেই, error কোড/reason লগ করা নিরাপদ
    console.log(`[messenger connect] OAuth বাতিল/ব্যর্থ: ${error}`);
    return NextResponse.redirect(buildPublicUrl("/dashboard/messenger?error=oauth_denied")!);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    console.warn("[messenger connect] state মেলেনি বা code নেই, CSRF/মেয়াদ-শেষ কুকি সন্দেহ");
    return NextResponse.redirect(buildPublicUrl("/dashboard/messenger?error=invalid_state")!);
  }

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(notConfiguredUrl);
  }

  // start/route.ts এর সাথে অভিন্ন মান হওয়া বাধ্যতামূলক — Facebook এই ঠিক একই redirect_uri দিয়েই
  // কোড ইস্যু করেছে, এক্সচেঞ্জের সময় সামান্য পার্থক্যও (ট্রেইলিং স্ল্যাশ, http/https) Facebook
  // "redirect_uri mismatch" এরর দেবে — তাই দুই রুটেই একই path দিয়ে buildPublicUrl() ব্যবহার
  const redirectUri = buildPublicUrl("/dashboard/messenger/connect/callback")!;

  const provider = new MetaMessengerProvider({ appId, appSecret });

  try {
    const { userAccessToken: shortLived } = await provider.exchangeCodeForUserToken(code, redirectUri);
    const { userAccessToken: longLived } = await provider.getLongLivedUserToken(shortLived);
    const pages = await provider.listPages(longLived);

    if (pages.length === 0) {
      return NextResponse.redirect(buildPublicUrl("/dashboard/messenger?error=no_pages")!);
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

    return NextResponse.redirect(buildPublicUrl("/dashboard/messenger/connect/select")!);
  } catch (err) {
    // err.message এ কখনো token থাকে না (messenger.ts এর safeFetch/parseGraphError দেখুন) —
    // শুধু Graph API এর নিজস্ব error মেসেজ (type/code), যেটা লগ করা নিরাপদ
    console.error("[messenger connect] OAuth এক্সচেঞ্জ/পেজ-লিস্ট ব্যর্থ:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(buildPublicUrl("/dashboard/messenger?error=oauth_failed")!);
  }
}
