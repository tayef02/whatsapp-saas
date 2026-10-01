import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildPublicUrl } from "@/lib/messenger-url";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const STATE_COOKIE = "messenger_oauth_state";

const NOT_CONFIGURED_MESSAGE =
  "Messenger সেটআপ হয়নি: MESSENGER_PUBLIC_URL এনভায়রনমেন্ট ভ্যারিয়েবল সেট করা নেই বা https:// দিয়ে শুরু হচ্ছে না।";

// route handler নিজে কোনো layout এর ভেতরে চলে না (dashboard/layout.tsx এর auth-check, এমনকি
// messenger/layout.tsx এর ফ্ল্যাগ-গার্ডও এখানে প্রযোজ্য হয় না — route.ts শুধু page.tsx কেই র‍্যাপ করে),
// তাই লগইন যাচাই আর ফ্ল্যাগ-চেক দুটোই এখানে আলাদাভাবে করতে হচ্ছে
export async function GET() {
  // এই রুটের প্রতিটা redirect নিচে MESSENGER_PUBLIC_URL থেকে বানানো হবে, request.url থেকে না
  // (কারণ উপরের কমেন্ট দেখুন) — তাই সবার আগে এটা বৈধ কিনা যাচাই, না হলে redirect বানানোরই
  // উপায় নেই, একটা স্পষ্ট এরর রেসপন্স দেওয়া হচ্ছে
  const dashboardUrl = buildPublicUrl("/dashboard");
  if (!dashboardUrl) {
    return new NextResponse(NOT_CONFIGURED_MESSAGE, { status: 500 });
  }

  if (process.env.NEXT_PUBLIC_MESSENGER_ENABLED !== "true") {
    return NextResponse.redirect(dashboardUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(buildPublicUrl("/login")!);
  }

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(buildPublicUrl("/dashboard/messenger?error=not_configured")!);
  }

  const redirectUri = buildPublicUrl("/dashboard/messenger/connect/callback")!;

  // CSRF সুরক্ষা — এই র‍্যান্ডম state Facebook callback এ ফেরত আসবে, কুকির মানের সাথে
  // না মিললে callback রিকোয়েস্ট বাতিল হবে
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/dashboard/messenger/connect",
  });

  const provider = new MetaMessengerProvider({ appId, appSecret });
  const oauthUrl = provider.getOAuthDialogUrl(redirectUri, state);

  return NextResponse.redirect(oauthUrl);
}
