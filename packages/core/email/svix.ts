import { createHmac, timingSafeEqual } from "node:crypto";

// Resend এর webhook Svix ফরম্যাটে সাইন করা। হেডার: svix-id, svix-timestamp, svix-signature
// সাইন হওয়া স্ট্রিং: `${id}.${timestamp}.${rawBody}`, HMAC-SHA256, কী = secret থেকে "whsec_"
// বাদ দিয়ে base64-ডিকোড। svix-signature = স্পেস দিয়ে আলাদা "v1,<base64>" এর তালিকা (একটা মিললেই চলবে)।
// নতুন প্যাকেজ ছাড়া Node crypto দিয়ে।
export function verifySvixSignature(args: {
  rawBody: string;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number; // replay ঠেকাতে — ডিফল্ট ৫ মিনিট
  nowMs?: number;
}): boolean {
  const { rawBody, id, timestamp, signatureHeader, secret } = args;
  const toleranceSeconds = args.toleranceSeconds ?? 300;
  const nowMs = args.nowMs ?? Date.now();

  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > toleranceSeconds) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`, "utf8").digest();

  for (const part of signatureHeader.split(" ")) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) continue;

    const provided = Buffer.from(signature, "base64");
    // দৈর্ঘ্য না মিললে timingSafeEqual নিজেই throw করে — আগে চেক
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return true;
  }

  return false;
}
