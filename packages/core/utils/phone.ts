// বাংলাদেশি মোবাইল নাম্বার নরমালাইজ করে 8801XXXXXXXXX ফরম্যাটে আনে।
// গ্রহণ করে: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, 1XXXXXXXXX (শুরুর 0 ছাড়া)
// মাঝে স্পেস/ড্যাশ/ব্র্যাকেট থাকলেও চলবে। ইনভ্যালিড হলে null রিটার্ন করে।
export function normalizeBangladeshiPhone(input: string): string | null {
  if (!input) return null;

  let s = input.trim().replace(/[\s\-()]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;

  let local: string; // টার্গেট: 0 দিয়ে শুরু ১১ ডিজিট

  if (s.startsWith("880") && s.length === 13) {
    local = "0" + s.slice(3);
  } else if (s.startsWith("0") && s.length === 11) {
    local = s;
  } else if (s.startsWith("1") && s.length === 10) {
    local = "0" + s;
  } else {
    return null;
  }

  // বাংলাদেশি মোবাইল অপারেটর প্রিফিক্স: 013-019
  if (!/^01[3-9]\d{8}$/.test(local)) return null;

  return "880" + local.slice(1);
}
