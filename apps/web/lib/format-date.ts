// bn-BD locale timezone ছাড়া দিলে যে এনভায়রনমেন্টে কোড চলছে তার নিজস্ব সিস্টেম timezone
// ব্যবহার করে — "use client" কম্পোনেন্টও Next.js প্রথমবার সার্ভারে (VPS, সাধারণত UTC) রেন্ডার
// করে, তাই timezone স্পষ্ট করে Asia/Dhaka না দিলে সার্ভার-সাইড রেন্ডারে ভুল (৬ ঘণ্টা এগিয়ে)
// সময় দেখানো হতো। এই হেল্পার দুটো ব্যবহার করলে সার্ভার/ক্লায়েন্ট যেখানেই রেন্ডার হোক, সবসময়
// বাংলাদেশ সময় দেখাবে।
export function formatDhakaDateTime(iso: string): string {
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

export function formatDhakaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" });
}

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

// "আজ" বা "গত N দিন" এর সীমানা বের করতে — সার্ভার যে timezone এই চলুক (VPS সাধারণত UTC),
// এই ফাংশন সবসময় Dhaka দিনের শুরু/শেষ ঠিকভাবে বের করে দেয়। daysAgo=0 মানে আজ, daysAgo=6 মানে ৭ দিন আগে।
// worker এর SQL ফাংশনেও একই কনভেনশন ব্যবহার হয় (migration 0010: date_trunc('day', now() at time zone 'Asia/Dhaka'))
export function getDhakaDayBoundariesUtc(daysAgo: number): { startIso: string; endIso: string } {
  const now = new Date();
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const y = dhakaNow.getUTCFullYear();
  const m = dhakaNow.getUTCMonth();
  const d = dhakaNow.getUTCDate() - daysAgo;
  const startIso = new Date(Date.UTC(y, m, d, 0, 0, 0) - DHAKA_OFFSET_MS).toISOString();
  const endIso = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - DHAKA_OFFSET_MS).toISOString();
  return { startIso, endIso };
}
