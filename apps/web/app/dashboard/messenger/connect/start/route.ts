import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const STATE_COOKIE = "messenger_oauth_state";

// route handler নিজে কোনো layout এর ভেতরে চলে না (dashboard/layout.tsx এর auth-check, এমনকি
// messenger/layout.tsx এর ফ্ল্যাগ-গার্ডও এখানে প্রযোজ্য হয় না — route.ts শুধু page.tsx কেই র‍্যাপ করে),
// তাই লগইন যাচাই আর ফ্ল্যাগ-চেক দুটোই এখানে আলাদাভাবে করতে হচ্ছে
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

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL("/dashboard/messenger?error=not_configured", request.url));
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.redirect(new URL("/dashboard/messenger?error=not_configured", request.url));
  }

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
  const redirectUri = `${appUrl}/dashboard/messenger/connect/callback`;
  const oauthUrl = provider.getOAuthDialogUrl(redirectUri, state);

  return NextResponse.redirect(oauthUrl);
}
