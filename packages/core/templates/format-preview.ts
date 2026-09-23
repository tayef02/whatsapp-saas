// শুধু প্রিভিউ দেখানোর জন্য — WhatsApp *bold*/_italic_ মার্কআপকে HTML এ বদলায়।
// আসল মেসেজ পাঠানোর সময় এই ফাংশন লাগে না, raw টেক্সটই যায় (WhatsApp নিজেই মার্কআপ বোঝে)।
// spintax + variable resolve হওয়ার *পরে* এটা চালাতে হবে, তাই কাস্টমারের ডাটায় _ থাকলেও
// ({{order_id}} এর মতো ভেরিয়েবল নামে) সমস্যা হয় না — ততক্ষণে ভেরিয়েবল আসল ভ্যালু দিয়ে বদলে গেছে।

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatWhatsAppPreviewHtml(renderedText: string): string {
  const escaped = escapeHtml(renderedText);
  return escaped
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}
