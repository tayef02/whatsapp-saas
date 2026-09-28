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
