import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// module import হওয়ার সময় না, বরং প্রথমবার ব্যবহারের সময় client বানানো হয়,
// যাতে index.ts এ .env লোড হওয়ার আগেই এটা তৈরি হয়ে না যায় (worker সবসময় service role দিয়ে চলে)
//
// Database টাইপ জেনারেট করা নেই (কোনো codegen সেটআপ নেই), তাই <any, any, any> দিয়ে
// টাইপ করা হয়েছে — নাহলে নতুন supabase-js এ .insert()/.update() এর প্যারামিটার
// টাইপ "never" এ রিজলভ হয়ে ভুল কম্পাইল এরর দেয়
let client: SupabaseClient<any, any, any> | null = null;

export function getSupabase() {
  if (!client) {
    client = createClient<any, any, any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return client;
}
