// Asia/Dhaka টাইমজোনে এখন quiet hours (যেমন রাত ১০টা–সকাল ৯টা) কিনা চেক করে।
// startHour > endHour ধরে নেওয়া হয় (মধ্যরাত পার হয়ে যায়), যেটা সাধারণ কেস।
export function isQuietHoursNow(startHour: number, endHour: number, now: Date = new Date()): boolean {
  // hour12:false এ কিছু ইঞ্জিনে মধ্যরাতকে "24" হিসেবে ফরম্যাট করে, তাই 0 এ নরমালাইজ করা হলো
  const rawHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(now)
  );
  const dhakaHour = rawHour === 24 ? 0 : rawHour;

  if (startHour === endHour) return false;

  if (startHour > endHour) {
    // যেমন 22 থেকে 9 — রাত পার হয়ে যায়
    return dhakaHour >= startHour || dhakaHour < endHour;
  }
  return dhakaHour >= startHour && dhakaHour < endHour;
}
