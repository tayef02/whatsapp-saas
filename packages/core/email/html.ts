// ইমেইলের HTML সংক্রান্ত ছোট হেল্পার — কোনো বাইরের প্যাকেজ ছাড়া।

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// টেমপ্লেট সেভের সময় বিপজ্জনক অংশ ছেঁটে ফেলে: <script>, <iframe>, <object>, <embed>, <form>, on*= হ্যান্ডলার,
// javascript: লিংক। (ইমেইল ক্লায়েন্ট এগুলো এমনিতেই ব্লক করে; এখানে ফেলা হয় যাতে স্প্যাম-ফিল্টারে
// ধরা না পড়ে আর প্রিভিউতে কিছু না চলে।) প্রিভিউ আবার sandbox করা iframe এ চলে — এটা একমাত্র সুরক্ষা না।
export function stripDangerousHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|input|button)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

// HTML থেকে plain text বানায় (ইউজার plain text না দিলে) — লিংক "লেখা (URL)" আকারে থাকে
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<a\b[^>]*href\s*=\s*("|')(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, "").trim();
      return label && label !== href ? `${label} (${href})` : href;
    })
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
