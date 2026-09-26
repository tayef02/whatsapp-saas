// লম্বা টেক্সটকে ছোট ছোট অংশে ভাঙে (embedding + retrieval এর জন্য)। প্যারাগ্রাফ (blank
// line) না থাকলেও প্রতিটা লাইনকে (single newline) একটা স্বাভাবিক ব্রেক পয়েন্ট হিসেবে ধরা
// হয় — নাহলে PDF থেকে বের হওয়া টেবিল-জাতীয় ডাটা (প্রতি row নতুন লাইনে, কিন্তু কোনো blank
// line ছাড়াই) পুরোটা একটাই চাংক হয়ে যেত, যেখানে একটা নির্দিষ্ট প্রোডাক্টের সিগন্যাল বাকি
// ১৪টা অপ্রাসঙ্গিক প্রোডাক্টের মধ্যে ডাইলিউট হয়ে সার্চের similarity অনেক কমে যায়।
// ছোট maxChars রাখা হয়েছে যাতে টেবিল-জাতীয় ডাটায় প্রতি চাংকে অল্প কয়েকটা row থাকে।
export function chunkText(text: string, maxChars = 400): string[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxChars) {
      current = line;
    } else {
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push(line.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);

  return chunks.filter((c) => c.trim().length > 0);
}
