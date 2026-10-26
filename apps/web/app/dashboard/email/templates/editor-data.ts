import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface EditorData {
  sampleContact: { email: string; name: string | null; custom_fields: Record<string, string> };
  variableSuggestions: string[];
  footer: { businessName: string; postalAddress: string };
}

// টেমপ্লেট এডিটরের প্রিভিউয়ের জন্য: workspace এর প্রথম ইমেইল কন্টাক্ট (নমুনা), কন্টাক্টে পাওয়া
// {{ভেরিয়েবল}} এর নাম, আর ফুটারের ব্যবসার নাম/ঠিকানা (সেটআপ পেজ থেকে; না থাকলে দেখানোর জন্য প্লেসহোল্ডার)
export async function loadEditorData(supabase: Supabase): Promise<EditorData> {
  const [{ data: contacts }, { data: profile }] = await Promise.all([
    supabase.from("email_contacts").select("email, name, custom_fields").order("created_at", { ascending: false }).limit(50),
    supabase.from("email_sender_profiles").select("business_name, postal_address").maybeSingle(),
  ]);

  const keys = new Set<string>(["name", "email"]);
  for (const row of contacts ?? []) {
    for (const key of Object.keys((row.custom_fields as Record<string, string>) ?? {})) keys.add(key);
  }

  const first = contacts?.[0];
  return {
    sampleContact: first
      ? { email: first.email, name: first.name, custom_fields: (first.custom_fields as Record<string, string>) ?? {} }
      : { email: "rahim@example.com", name: "রহিম", custom_fields: {} },
    variableSuggestions: Array.from(keys),
    footer: {
      businessName: profile?.business_name ?? "আপনার ব্যবসার নাম",
      postalAddress: profile?.postal_address ?? "আপনার ব্যবসার ঠিকানা",
    },
  };
}
