const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "বন্ধ", "বন্ধ করুন"]);

// ছোট-বড় হাতের অক্ষর, আগে-পরের স্পেস — সব বাদ দিয়ে exact match চেক করে
export function isStopKeyword(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return STOP_KEYWORDS.has(normalized);
}
