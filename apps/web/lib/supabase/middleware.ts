import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// প্রতি রিকোয়েস্টে Supabase সেশন টোকেন রিফ্রেশ করে —
// এটা না করলে ইউজার কিছুক্ষণ পর পর লগআউট হয়ে যাবে
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // পাসওয়ার্ড রিসেট ফ্লো (/reset-password এ হ্যাশে #access_token আসে, যেটা সার্ভারে কখনো
  // যায় না — তাই এখানে গেট করা যাবে না, ক্লায়েন্ট-সাইডে পার্স হতে দিতে হবে), আইনি পেজ, আর
  // নতুন (marketing) সাইটের পেজ — এগুলোয় লগইন ছাড়াও ঢোকা যাবে
  const publicPaths = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/terms",
    "/privacy",
    "/data-deletion",
    "/features",
    "/pricing",
    "/about",
    "/contact",
    "/faq",
    // OAuth (Google/Facebook/LinkedIn) ফেরত আসার রুট — তখনো সেশন নেই, তাই পাবলিক
    "/auth/callback",
  ];
  // "/" কে .startsWith() দিয়ে publicPaths এ রাখা যাবে না — তাহলে প্রতিটা পাথই ("/" দিয়ে শুরু)
  // পাবলিক হয়ে যেত, তাই আলাদা exact-match চেক
  const isPublicRoute = request.nextUrl.pathname === "/" || publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  // লগইন না থাকলে dashboard/onboarding এ ঢুকতে দেবে না
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
