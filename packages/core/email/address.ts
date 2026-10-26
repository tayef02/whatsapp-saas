// ইমেইল ঠিকানা নরমালাইজ ও ফরম্যাট যাচাই। null মানে ঠিকানাটা গ্রহণযোগ্য না।
// সাধারণ ASCII ঠিকানা (RFC 5322 এর বাস্তবসম্মত উপসেট) চলে; বাংলা/ইউনিকোড লোকাল-পার্ট (IDN) এখন
// গ্রহণ করা হয় না — প্রোভাইডার ও বেশিরভাগ ইনবক্সে সমস্যা করে।

const LOCAL_PART = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;

  const at = email.lastIndexOf("@");
  if (at < 1 || email.indexOf("@") !== at) return null; // ঠিক একটা @, শুরুতে না

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64 || !LOCAL_PART.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;

  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return null;

  // শেষ অংশ (TLD): কমপক্ষে ২ অক্ষর, শুধু অক্ষর (বা punycode xn--)
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(tld)) return null;

  return email;
}
