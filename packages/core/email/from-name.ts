// From নাম যাচাই + ব্লক-তালিকা। শেয়ার্ড প্ল্যাটফর্ম ডোমেইনে একজন ব্যবহারকারী "bKash Support" নামে
// পাঠালে ছদ্মবেশ (phishing) হয় আর পুরো ডোমেইনের সুনাম যায় — তাই তালিকার শব্দ থাকলে নাম সেভ হয় না,
// সুপার অ্যাডমিন অনুমোদন দিলে তবেই চালু হয়।

const MAX_LENGTH = 60;

// নতুন নিষিদ্ধ শব্দ যোগ করতে এই তালিকায় যোগ করুন (ছোট হাতের, বিজ্ঞাপন/ব্র্যান্ড)
// ম্যাচিং: নাম থেকে ফাঁকা/চিহ্ন বাদ দিয়ে, ছোট হাতের করে, "ভেতরে আছে কিনা" দেখা হয় — তাই "Bank" শব্দ
// থাকলেই ধরা পড়ে (কখনো-কখনো বৈধ নামও ধরা পড়ে; সেক্ষেত্রে অনুমোদনের অপেক্ষায় থাকে, ব্যর্থ নয়)
const BLOCKED_TERMS = [
  // মোবাইল ব্যাংকিং / পেমেন্ট
  "bkash", "bikash", "nagad", "paypal", "mastercard", "payoneer",
  // ব্যাংক / সরকার
  "bank", "gov", "government", "police", "ministry", "customs", "btrc",
  // পরিচিত ব্র্যান্ড
  "daraz", "pathao", "foodpanda", "grameenphone", "banglalink", "airtel", "teletalk",
  "google", "facebook", "whatsapp", "instagram", "amazon", "apple", "microsoft", "netflix",
  // নিজেদের প্ল্যাটফর্ম / প্রোভাইডার
  "genz", "resend",
  // বাংলা
  "বিকাশ", "নগদ", "ব্যাংক", "সরকার", "সরকারি", "পুলিশ", "মন্ত্রণালয়",
];

export type FromNameFormat = { ok: true; name: string } | { ok: false; error: string };

// ফরম্যাট যাচাই: দৈর্ঘ্য, আর ইমেইল হেডারে গোলমাল বাধায় এমন অক্ষর (header injection ঠেকাতে) নিষিদ্ধ
export function validateFromNameFormat(raw: string): FromNameFormat {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "From নাম দিন" };
  if (name.length > MAX_LENGTH) return { ok: false, error: `From নাম সর্বোচ্চ ${MAX_LENGTH} অক্ষর` };
  if (/[<>@",;:\\\u0000-\u001f]/.test(name)) {
    return { ok: false, error: 'From নামে < > @ " , ; : \\ এই চিহ্নগুলো ব্যবহার করা যাবে না' };
  }
  return { ok: true, name };
}

// অক্ষরের বদলে সংখ্যা দিয়ে ফাঁকি (b1kash, n4gad) ধরার জন্য সংখ্যাকে অক্ষরে ম্যাপ করা হয়
const DIGIT_MAPS: Array<Record<string, string>> = [
  { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" },
  { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t" },
];

function compact(name: string): string {
  return name.toLowerCase().replace(/[\s._\-|&'()]+/g, "");
}

export type BlockCheck = { blocked: false } | { blocked: true; term: string };

export function checkBlockedFromName(name: string): BlockCheck {
  const base = compact(name);
  const variants = [base, ...DIGIT_MAPS.map((map) => base.replace(/[0-9]/g, (d) => map[d] ?? d))];

  for (const term of BLOCKED_TERMS) {
    if (variants.some((v) => v.includes(term))) return { blocked: true, term };
  }
  return { blocked: false };
}
