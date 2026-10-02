import { createAdminClient } from "@/lib/supabase/admin";
import type { Lang } from "./lang";

export type Plan = {
  id: string;
  name: string;
  price_bdt: number;
  monthly_message_limit: number;
  contact_limit: number;
  max_numbers: number;
  duration_days: number;
  is_trial: boolean;
};

// plans টেবিলে শুধু `authenticated` রোলের GRANT আছে (migration 0012) — পাবলিক মূল্য পেজ
// থেকে anon রোল দিয়ে সরাসরি পড়া যাবে না। নতুন GRANT migration না বানিয়ে, এখানে শুধু
// সার্ভারে (কখনো browser এ যায় না) service_role ক্লায়েন্ট দিয়ে read-only পড়া হচ্ছে।
export async function getPlans(): Promise<{ plans: Plan[]; usedFallback: boolean }> {
  // DB থেকে পড়া ব্যর্থ হলে পেজ যেন না ভাঙে — এই মানগুলোই migration 0012 এর বর্তমান seed
  // ডাটা, ফলব্যাক হিসেবে ব্যবহার হচ্ছে
  const fallback: Plan[] = [
    { id: "fallback-trial", name: "ট্রায়াল", price_bdt: 0, monthly_message_limit: 100, contact_limit: 200, max_numbers: 1, duration_days: 7, is_trial: true },
    { id: "fallback-starter", name: "স্টার্টার", price_bdt: 990, monthly_message_limit: 2000, contact_limit: 2000, max_numbers: 1, duration_days: 30, is_trial: false },
    { id: "fallback-pro", name: "প্রো", price_bdt: 2490, monthly_message_limit: 10000, contact_limit: 10000, max_numbers: 3, duration_days: 30, is_trial: false },
    { id: "fallback-business", name: "বিজনেস", price_bdt: 4990, monthly_message_limit: 30000, contact_limit: 30000, max_numbers: 10, duration_days: 30, is_trial: false },
  ];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, price_bdt, monthly_message_limit, contact_limit, max_numbers, duration_days, is_trial")
      .eq("is_active", true)
      .order("price_bdt", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.error("[marketing plans] plans টেবিল পড়া ব্যর্থ, ফলব্যাক দেখানো হচ্ছে:", error.message);
      return { plans: fallback, usedFallback: true };
    }
    return { plans: data as Plan[], usedFallback: false };
  } catch (err) {
    console.error("[marketing plans] plans টেবিল পড়তে এরর, ফলব্যাক দেখানো হচ্ছে:", err instanceof Error ? err.message : err);
    return { plans: fallback, usedFallback: true };
  }
}

// DB তে প্ল্যানের নাম বাংলায় (ট্রায়াল/স্টার্টার/প্রো/বিজনেস) — English দেখানোর সময় শুধু ডিসপ্লে নাম বদলায়,
// অজানা নাম (নতুন প্ল্যান যোগ হলে) যেমন আছে তেমনই দেখায়
const EN_PLAN_NAMES: Record<string, string> = { ট্রায়াল: "Trial", স্টার্টার: "Starter", প্রো: "Pro", বিজনেস: "Business" };

export function planDisplayName(name: string, lang: Lang) {
  return lang === "en" ? (EN_PLAN_NAMES[name] ?? name) : name;
}

export function isPopularPlan(name: string) {
  return name === "প্রো" || name === "Pro";
}

export function formatNumber(n: number, lang: Lang) {
  return n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
}

export function lowestPaidPrice(plans: Plan[]) {
  const paid = plans.filter((p) => !p.is_trial && p.price_bdt > 0);
  return paid.length ? Math.min(...paid.map((p) => p.price_bdt)) : null;
}
