import { createHmac, timingSafeEqual } from "node:crypto";

// স্টেটলেস সাইন-করা টোকেন (ডাটাবেস লুকআপ ছাড়া যাচাই হয়) — unsubscribe লিংক আর Reply-To
// কনফার্মেশন লিংকে ব্যবহার হয়। ফরম্যাট: v1.<base64url(JSON)>.<base64url(HMAC)>
// "purpose" HMAC এর ভেতরে ঢোকে, তাই এক উদ্দেশ্যের টোকেন অন্য উদ্দেশ্যে চলে না।
//
// ⚠ টোকেনে প্রাপকের ইমেইল ঠিকানা থাকে (base64url, গোপন না) — এই URL কখনো লগে ছাপা যাবে না।

type Purpose = "unsub" | "replyto";

function sign(secret: string, purpose: Purpose, payloadB64: string): Buffer {
  return createHmac("sha256", secret).update(`${purpose}.${payloadB64}`, "utf8").digest();
}

function createToken(secret: string, purpose: Purpose, payload: object): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `v1.${payloadB64}.${sign(secret, purpose, payloadB64).toString("base64url")}`;
}

function readToken(secret: string, purpose: Purpose, token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payloadB64, signatureB64] = parts;

  const expected = sign(secret, purpose, payloadB64);
  const provided = Buffer.from(signatureB64, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ---- Unsubscribe টোকেন (মেয়াদ নেই — পুরনো ইমেইলের লিংকও চলবে) ----

export interface UnsubscribePayload {
  workspaceId: string;
  email: string; // lower-case
  campaignId: string | null;
}

export function createUnsubscribeToken(secret: string, payload: UnsubscribePayload): string {
  return createToken(secret, "unsub", { w: payload.workspaceId, e: payload.email.toLowerCase(), c: payload.campaignId });
}

export function verifyUnsubscribeToken(secret: string, token: string): UnsubscribePayload | null {
  const p = readToken(secret, "unsub", token);
  if (!p || typeof p.w !== "string" || typeof p.e !== "string") return null;
  return { workspaceId: p.w, email: p.e, campaignId: typeof p.c === "string" ? p.c : null };
}

// ---- Reply-To কনফার্মেশন টোকেন (২৪ ঘণ্টা মেয়াদ) ----

export const REPLY_TO_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface ReplyToPayload {
  workspaceId: string;
  email: string; // lower-case — প্রোফাইলের বর্তমান ঠিকানার সাথে মিলতে হবে
  expiresAt: number; // epoch ms
}

export function createReplyToToken(secret: string, payload: ReplyToPayload): string {
  return createToken(secret, "replyto", { w: payload.workspaceId, e: payload.email.toLowerCase(), x: payload.expiresAt });
}

export function verifyReplyToToken(secret: string, token: string, nowMs: number = Date.now()): ReplyToPayload | null {
  const p = readToken(secret, "replyto", token);
  if (!p || typeof p.w !== "string" || typeof p.e !== "string" || typeof p.x !== "number") return null;
  if (p.x < nowMs) return null;
  return { workspaceId: p.w, email: p.e, expiresAt: p.x };
}
