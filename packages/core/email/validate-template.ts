// ইমেইল টেমপ্লেটের যাচাই। WhatsApp এর validateTemplateBraces এখানে চলে না — HTML এর <style> এ
// CSS ব্র্যাকেট ({ }) থাকে, সেটা ভুল ধরত। তাই শুধু {{ }} (ভেরিয়েবল) জোড়া মেলে কিনা দেখা হয়।

export const EMAIL_SUBJECT_MAX = 300;
export const EMAIL_HTML_MAX = 200_000;
export const EMAIL_TEXT_MAX = 100_000;
// Gmail ~১০২KB এর বেশি HTML কেটে দেয় ("[Message clipped]") — সতর্কতা দেখানোর সীমা
export const EMAIL_HTML_WARN = 100_000;

export function validateVariableBraces(text: string): string | null {
  const open = (text.match(/\{\{/g) ?? []).length;
  const close = (text.match(/\}\}/g) ?? []).length;
  return open === close ? null : "{{ আর }} (ভেরিয়েবল) জোড়ায় জোড়ায় নেই — কোথাও ভুল আছে";
}

export interface TemplateInput {
  name: string;
  category: string | null;
  subject: string;
  preheader: string | null;
  body_html: string;
  body_text: string;
}

export function validateEmailTemplate(input: TemplateInput): string | null {
  if (!input.name.trim()) return "টেমপ্লেটের নাম দিন";
  if (input.name.length > 120) return "নাম সর্বোচ্চ ১২০ অক্ষর";
  if (!input.subject.trim()) return "সাবজেক্ট দিন";
  if (input.subject.length > EMAIL_SUBJECT_MAX) return `সাবজেক্ট সর্বোচ্চ ${EMAIL_SUBJECT_MAX} অক্ষর`;
  if (!input.body_html.trim()) return "ইমেইলের HTML বডি দিন";
  if (input.body_html.length > EMAIL_HTML_MAX) return `HTML সর্বোচ্চ ${EMAIL_HTML_MAX} অক্ষর`;
  if (input.body_text.length > EMAIL_TEXT_MAX) return `Plain text সর্বোচ্চ ${EMAIL_TEXT_MAX} অক্ষর`;
  if (input.preheader && input.preheader.length > 200) return "প্রিহেডার সর্বোচ্চ ২০০ অক্ষর";

  for (const [label, value] of [
    ["সাবজেক্ট", input.subject],
    ["HTML", input.body_html],
    ["Plain text", input.body_text],
    ["প্রিহেডার", input.preheader ?? ""],
  ] as const) {
    const error = validateVariableBraces(value);
    if (error) return `${label}: ${error}`;
  }
  return null;
}
