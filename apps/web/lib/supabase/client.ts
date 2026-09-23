import { createBrowserClient } from "@supabase/ssr";

// browser (client component) এ ব্যবহারের জন্য Supabase client
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
