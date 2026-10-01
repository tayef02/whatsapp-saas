// Messenger OAuth এর যেকোনো redirect (সফল বা ব্যর্থ) কখনো request.url থেকে বানানো হবে না —
// VPS এ Nginx/Docker এর পেছনে request.url এ ভুল host/protocol (ইন্টারনাল docker হোস্ট, বা
// http) আসতে পারে, যেটা আগে একবার Facebook এর OAuth redirect_uri কেই ভেঙে দিয়েছিল। এর বদলে
// MESSENGER_PUBLIC_URL (স্থায়ী, পাবলিক HTTPS ডোমেইন) থেকেই সবসময় বানাতে হবে। না থাকলে বা
// https:// দিয়ে শুরু না হলে null — কলার তখন চুপচাপ কিছু ধরে না নিয়ে স্পষ্ট এরর দেখাবে।
export function buildPublicUrl(path: string): string | null {
  const raw = process.env.MESSENGER_PUBLIC_URL;
  if (!raw) return null;

  const base = raw.replace(/\/+$/, "");
  if (!base.startsWith("https://")) return null;

  return `${base}${path}`;
}

export function buildMessengerRedirectUri(): string | null {
  return buildPublicUrl("/dashboard/messenger/connect/callback");
}
