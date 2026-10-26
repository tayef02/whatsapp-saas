import { renderTemplateVariables, extractVariableKeys } from "../templates/variables";
import { escapeHtml, htmlToText } from "./html";

// ইমেইল টেমপ্লেট থেকে আসল সাবজেক্ট/HTML/text বানানোর একমাত্র জায়গা — প্রিভিউ আর (ফেজ ৩) আসল
// পাঠানো দুটোই এটা ব্যবহার করবে। spintax ইচ্ছাকৃতভাবে নেই (ইমেইলে সাবজেক্ট এলোমেলো করা ঝুঁকিপূর্ণ)।
// ফুটার/আনসাবস্ক্রাইব এখানে যোগ হয় না — সেটা পাঠানোর ধাপে appendEmailFooter() (compose.ts) সবসময়
// নিজে যোগ করে, ইউজার সরাতে পারে না।

export interface EmailRenderContact {
  email?: string | null;
  name?: string | null;
  custom_fields?: Record<string, string> | null;
}

export interface EmailTemplateParts {
  subject: string;
  preheader?: string | null;
  body_html: string;
  body_text: string;
}

// বাংলা ফন্ট: প্রথমে Noto Sans Bengali (থাকলে), তারপর Windows/Android/macOS এর নিজস্ব বাংলা ফন্ট,
// শেষে সাধারণ sans-serif। ইমেইল ক্লায়েন্ট ওয়েব ফন্ট লোড করে না বললেই চলে, তাই এই fallback চেইনই আসল ভরসা
export const EMAIL_FONT_STACK =
  "'Noto Sans Bengali','Hind Siliguri','Nirmala UI','Kalpurush','Siyam Rupali',Vrinda,Arial,Helvetica,sans-serif";

function escapeContact(contact: EmailRenderContact): EmailRenderContact {
  const custom: Record<string, string> = {};
  for (const [key, value] of Object.entries(contact.custom_fields ?? {})) custom[key] = escapeHtml(String(value));
  return {
    email: contact.email ? escapeHtml(contact.email) : contact.email,
    name: contact.name ? escapeHtml(contact.name) : contact.name,
    custom_fields: custom,
  };
}

// ইউজার পুরো <html> ডকুমেন্ট না দিলে charset + বাংলা ফন্টসহ র‍্যাপার দিয়ে মোড়ানো হয়
function wrapHtml(inner: string): string {
  if (/<\s*html[\s>]/i.test(inner)) return inner;
  return (
    `<!doctype html><html lang="bn"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:16px;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:1.6;color:#111827">` +
    inner +
    `</body></html>`
  );
}

export function renderEmailTemplate(template: EmailTemplateParts, contact: EmailRenderContact): { subject: string; html: string; text: string } {
  // সাবজেক্টে নতুন লাইন থাকলে হেডার ভাঙতে পারে (header injection) — সবসময় এক লাইন
  const subject = renderTemplateVariables(template.subject, contact).replace(/[\r\n]+/g, " ").trim();

  // HTML এ কাস্টমারের ডাটা escape করে বসে (নামে `<` থাকলে HTML ভাঙবে না); টেমপ্লেট লেখকের ডিফল্ট ({{name|ভাই}}) trusted
  const preheader = template.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(renderTemplateVariables(template.preheader, contact))}</div>`
    : "";
  const bodyHtml = renderTemplateVariables(template.body_html, escapeContact(contact));
  const html = wrapHtml(preheader + bodyHtml);

  // plain text না থাকলে HTML (ভেরিয়েবল বসানো) থেকে বানানো
  const text = template.body_text.trim()
    ? renderTemplateVariables(template.body_text, contact)
    : htmlToText(renderTemplateVariables(template.body_html, contact));

  return { subject, html, text };
}

export { extractVariableKeys };
