// অ্যাপের পাবলিক ব্রাউজার-ফেসিং URL বানানোর হেল্পার — পাসওয়ার্ড রিসেট ইমেইলের মতো জায়গায়
// ব্যবহার হয়, যেখানে লিংকটা সরাসরি ইউজারের ব্রাউজারে খুলবে। APP_URL (Evolution webhook এর
// জন্য, docker-internal হতে পারে) এখানে কাজ করবে না — messenger-url.ts এর buildPublicUrl()
// এর ঠিক একই কারণ/প্যাটার্ন, শুধু https বাধ্যতামূলক না (লোকাল ডেভে http://localhost ভ্যালিড
// হওয়া দরকার, Messenger এর মতো কোনো তৃতীয়-পক্ষ (Facebook) এখানে https জোর করছে না)।
export function buildAppPublicUrl(path: string): string | null {
  const raw = process.env.APP_PUBLIC_URL;
  if (!raw) return null;

  const base = raw.replace(/\/+$/, "");
  if (!base.startsWith("http://") && !base.startsWith("https://")) return null;

  return `${base}${path}`;
}
