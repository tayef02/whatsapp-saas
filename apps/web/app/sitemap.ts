import type { MetadataRoute } from "next";
import { buildAppPublicUrl } from "@/lib/public-url";

// শুধু পাবলিক মার্কেটিং পেজ + আইনি পেজ — /dashboard, /login ইত্যাদি sitemap এ থাকার দরকার নেই
// (সার্চ ইঞ্জিনে ইনডেক্স হওয়ার মতো পাবলিক কনটেন্ট না, robots.ts এও disallow করা আছে)
const routes = ["/", "/features", "/pricing", "/about", "/contact", "/faq", "/terms", "/privacy", "/data-deletion"];

export default function sitemap(): MetadataRoute.Sitemap {
  // APP_PUBLIC_URL সেট না থাকলে (যেমন লোকাল ডেভে .env.local এ না বসালে) একটা ফলব্যাক
  // ডোমেইন — sitemap.xml ভাঙার চেয়ে ভুল হলেও একটা URL দেখানো ভালো, প্রোডাকশনে এটা সেট
  // থাকবেই (অন্যান্য ফিচার, যেমন পাসওয়ার্ড রিসেট, এটার উপর নির্ভরশীল)
  const base = buildAppPublicUrl("") ?? "http://localhost:3000";

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
