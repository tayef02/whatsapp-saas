import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// শুধু বিশ্বস্ত server-side কোডের জন্য — RLS বাইপাস করে, তাই কখনো browser এ পাঠাবেন না।
// ব্যবহার হবে যেখানে infra-লেভেল কাজ লাগে (যেমন evolution_servers পড়া),
// সাধারণ ইউজার ডাটার জন্য lib/supabase/server.ts ব্যবহার করুন যাতে RLS প্রযোজ্য হয়।
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
