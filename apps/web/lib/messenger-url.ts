// Facebook এর OAuth redirect_uri ব্রাউজার সরাসরি ভিজিট করে, তাই এটা অবশ্যই পাবলিক HTTPS URL
// হতে হবে — APP_URL (WhatsApp webhook এর জন্য, docker-internal http হতে পারে) এখানে কাজ করবে
// না। MESSENGER_PUBLIC_URL না থাকলে বা https না হলে null রিটার্ন করে (চুপচাপ localhost/http
// ধরে নেওয়া হয় না), কলার তখন স্পষ্ট "not_configured" এরর দেখাবে।
export function buildMessengerRedirectUri(): string | null {
  const raw = process.env.MESSENGER_PUBLIC_URL;
  if (!raw) return null;

  const base = raw.replace(/\/+$/, "");
  if (!base.startsWith("https://")) return null;

  return `${base}/dashboard/messenger/connect/callback`;
}
