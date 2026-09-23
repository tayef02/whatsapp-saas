import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// server component / server action / route handler এ ব্যবহারের জন্য
// Supabase client — লগইন করা ইউজারের কুকি থেকে সেশন পড়ে, তাই RLS ঠিকমতো কাজ করে
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // server component থেকে কল হলে cookie সেট করা যায় না —
            // middleware.ts সেশন রিফ্রেশ সামলে নেয়, তাই এখানে ইগনোর করা নিরাপদ
          }
        },
      },
    }
  );
}
