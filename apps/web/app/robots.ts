import type { MetadataRoute } from "next";
import { buildAppPublicUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  const base = buildAppPublicUrl("") ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/features", "/pricing", "/about", "/contact", "/faq", "/terms", "/privacy", "/data-deletion"],
      // dashboard/login/onboarding ইত্যাদি কখনোই পাবলিক ইনডেক্সে যাওয়া উচিত না — লগইন ছাড়া
      // ঢোকাও যায় না (middleware.ts), কিন্তু সার্চ ইঞ্জিনকে আলাদা করে বলে দেওয়া ভালো
      disallow: ["/dashboard", "/login", "/signup", "/forgot-password", "/reset-password", "/onboarding", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
