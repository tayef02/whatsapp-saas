import { NextRequest, NextResponse } from "next/server";
import { readUnsubscribeToken, unsubscribeByToken } from "@/lib/email/unsubscribe";
import { buildAppPublicUrl } from "@/lib/public-url";

// List-Unsubscribe হেডারের URL (Gmail/Yahoo এর "Unsubscribe" বোতাম) — one-click POST (RFC 8058)
// এখানে আসে। কোনো লগইন/কুকি লাগে না (middleware matcher থেকে বাদ)। টোকেন সাইন-করা, তাই নিরাপদ।
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = readUnsubscribeToken(token);
  if (!payload) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const ok = await unsubscribeByToken(payload, "one_click");
  if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ status: "ok" });
}

// কিছু মেইল ক্লায়েন্ট হেডারের URL ব্রাউজারে (GET) খোলে — GET এ কিছু বদলায় না, নিশ্চিতকরণ
// পেজে পাঠিয়ে দেওয়া হয় (স্ক্যানার আগে খুললেও কেউ ভুলে আনসাবস্ক্রাইব হয় না)
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Traefik/Nginx এর পেছনে request.url এ ভুল host আসতে পারে (messenger-url.ts এর মতো), তাই পাবলিক URL আগে
  const target = buildAppPublicUrl(`/u/${token}`) ?? new URL(`/u/${token}`, request.url).toString();
  return NextResponse.redirect(target, 302);
}
