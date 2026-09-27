// গ্রুপে নির্দিষ্ট ফরম্যাটে ("ORDER: নাম, নাম্বার, প্রোডাক্ট[, quantity]" বা বাংলায়
// "অর্ডার: ...") মেসেজ এলে সরাসরি regex দিয়ে পার্স করা হয় — AI/keyword ট্রিগার ছাড়াই কাজ
// করে, তাই AI চালু নেই এমন workspace-এও অর্ডার ধরা যায়।
export type CapturedGroupOrder = {
  name: string | null;
  phone: string | null;
  product: string | null;
  quantity: string | null;
};

const ORDER_PREFIX_PATTERN = /^\s*(order|অর্ডার)\s*[:：]\s*/i;

// প্যাটার্ন না মিললে null — মিললে (এমনকি ফিল্ড খালি/অসম্পূর্ণ হলেও) একটা অবজেক্ট রিটার্ন করে,
// caller ঠিক করবে অসম্পূর্ণ হলে কী করবে (raw_summary হিসেবে সেভ করে ডাটা না হারানো)
export function extractStructuredOrder(text: string): CapturedGroupOrder | null {
  const match = text.match(ORDER_PREFIX_PATTERN);
  if (!match) return null;

  const rest = text.slice(match[0].length).trim();
  if (!rest) return { name: null, phone: null, product: null, quantity: null };

  const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);

  return {
    name: parts[0] || null,
    phone: parts[1] || null,
    product: parts[2] || null,
    quantity: parts[3] || null,
  };
}
