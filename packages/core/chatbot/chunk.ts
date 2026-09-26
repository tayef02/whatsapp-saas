// লম্বা টেক্সটকে ছোট ছোট অংশে ভাঙে (embedding + retrieval এর জন্য) — প্যারাগ্রাফ ধরে
// ভাঙার চেষ্টা করে, কোনো প্যারাগ্রাফ খুব বড় হলে maxChars এ জোর করে কাটে
export function chunkText(text: string, maxChars = 1000): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (para.length <= maxChars) {
      current = para;
    } else {
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);

  return chunks.filter((c) => c.trim().length > 0);
}
