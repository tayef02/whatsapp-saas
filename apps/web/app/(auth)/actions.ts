"use server";

import { createClient } from "@/lib/supabase/server";
import { buildAppPublicUrl } from "@/lib/public-url";

// রিটার্ন টাইপ: এরর থাকলে { error }, নাহলে সফল রিডাইরেক্ট হবে caller-এ
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("fullName") ?? "");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Supabase নিজেই রিসেট ইমেইল পাঠায় (ইমেইলের টেমপ্লেট Supabase Dashboard এ কনফিগার করা) —
// লিংকে ক্লিক করলে /reset-password এ #access_token=...&type=recovery হ্যাশসহ আসবে।
// Supabase Dashboard > Authentication > URL Configuration এ এই redirectTo অবশ্যই
// Redirect URLs allow-list এ থাকতে হবে, নাহলে Supabase লিংক রিজেক্ট করবে।
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "ইমেইল দিন" };

  const redirectTo = buildAppPublicUrl("/reset-password");
  if (!redirectTo) {
    console.error("[requestPasswordReset] APP_PUBLIC_URL সেট করা নেই বা ভুল");
    return { error: "সার্ভার সেটআপ অসম্পূর্ণ — অ্যাডমিনকে জানান (APP_PUBLIC_URL)" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.error(`[requestPasswordReset] ব্যর্থ:`, error.message);
    return { error: error.message };
  }

  return { error: null };
}
