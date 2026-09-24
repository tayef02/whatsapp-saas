const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "বন্ধ", "বন্ধ করুন"]);
const START_KEYWORDS = new Set(["start", "চালু", "চালু করুন"]);

// ছোট-বড় হাতের অক্ষর, আগে-পরের স্পেস — সব বাদ দিয়ে exact match চেক করে
export function isStopKeyword(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return STOP_KEYWORDS.has(normalized);
}

// STOP করার পর কন্টাক্ট নিজে START লিখলে আবার চালু হবে
export function isStartKeyword(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return START_KEYWORDS.has(normalized);
}
