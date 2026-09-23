import { createClient } from "@supabase/supabase-js";

// module import হওয়ার সময় না, বরং প্রথমবার ব্যবহারের সময় client বানানো হয়,
// যাতে index.ts এ .env লোড হওয়ার আগেই এটা তৈরি হয়ে না যায় (worker সবসময় service role দিয়ে চলে)
let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return client;
}
