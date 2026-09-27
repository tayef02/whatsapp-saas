import { ORDER_BLOCK_START, ORDER_BLOCK_END } from "./constants";

export type ParsedOrder = {
  product_name?: string;
  quantity?: string;
  delivery_name?: string;
  delivery_phone?: string;
  delivery_address?: string;
};

export type ExtractedOrderBlock = {
  cleanText: string;
  rawBlock: string | null;
  parsed: ParsedOrder | null;
  parseError: string | null;
};

// LLM এর রেসপন্স থেকে [ORDER_CONFIRMED]{...}[/ORDER_CONFIRMED] ব্লক খুঁজে বের করে, কাস্টমার-মুখী
// টেক্সট থেকে ছেঁটে ফেলে, আর ভিতরের JSON পার্স করার চেষ্টা করে। পার্সিং ব্যর্থ হলেও raw টেক্সট
// (rawBlock) রাখা হয় যাতে caller অন্তত raw_summary হিসেবে সেভ করে ডাটা না হারায়।
export function extractOrderBlock(text: string): ExtractedOrderBlock {
  const startIdx = text.indexOf(ORDER_BLOCK_START);
  const endIdx = text.indexOf(ORDER_BLOCK_END);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { cleanText: text, rawBlock: null, parsed: null, parseError: null };
  }

  const rawBlock = text.slice(startIdx + ORDER_BLOCK_START.length, endIdx).trim();
  const cleanText = (text.slice(0, startIdx) + text.slice(endIdx + ORDER_BLOCK_END.length)).trim();

  try {
    const parsed = JSON.parse(rawBlock) as ParsedOrder;
    return { cleanText, rawBlock, parsed, parseError: null };
  } catch (err) {
    return { cleanText, rawBlock, parsed: null, parseError: err instanceof Error ? err.message : "unknown JSON parse error" };
  }
}
