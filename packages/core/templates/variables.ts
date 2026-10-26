export interface RenderContact {
  name?: string | null;
  phone?: string | null;
  // শুধু ইমেইল চ্যানেল পাঠায়; WhatsApp কন্টাক্টে নেই, তাই {{email}} সেখানে আগের মতোই custom_fields থেকে আসে
  email?: string | null;
  custom_fields?: Record<string, string> | null;
}

// {{key}} অথবা {{key|ডিফল্ট}} — ডিফল্ট থাকলে ডাটা না পেলে সেটা বসবে, নাহলে ফাঁকা।
// কাস্টমারের মেসেজে কখনো "{{name}}" এর মতো raw প্লেসহোল্ডার থেকে যাবে না।
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\s*\}\}/g;

function lookupVariable(key: string, contact: RenderContact): string {
  if (key === "name") return contact.name ?? "";
  if (key === "phone") return contact.phone ?? "";
  if (key === "email" && contact.email) return contact.email;
  return contact.custom_fields?.[key] ?? "";
}

// resolveSpintax() এর *পরে* এটা চালাতে হবে (দেখুন spintax.ts এর কমেন্ট)
export function renderTemplateVariables(text: string, contact: RenderContact): string {
  return text.replace(VARIABLE_PATTERN, (_match, key: string, fallback?: string) => {
    const value = lookupVariable(key, contact);
    if (value) return value;
    return fallback ?? "";
  });
}

// টেমপ্লেটে কোন কোন {{key}} ব্যবহার হয়েছে বের করে — coverage চেক আর সাজেশন চিপের জন্য
export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    keys.add(match[1]);
  }
  return Array.from(keys);
}
