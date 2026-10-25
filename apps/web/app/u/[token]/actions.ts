"use server";

import { redirect } from "next/navigation";
import { readUnsubscribeToken, unsubscribeByToken } from "@/lib/email/unsubscribe";

// নিশ্চিতকরণ বোতামে চাপ দিলে — এখানেই আসল আনসাবস্ক্রাইব। সফল/ব্যর্থ দুই ক্ষেত্রেই পেজে ফেরত
// (টোকেন আর ইমেইল URL এ থাকে, কিন্তু কখনো লগে যায় না)
export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const payload = readUnsubscribeToken(token);
  if (!payload) redirect(`/u/${encodeURIComponent(token)}`);

  const ok = await unsubscribeByToken(payload, "unsubscribe_link");
  redirect(`/u/${encodeURIComponent(token)}?${ok ? "done=1" : "error=1"}`);
}
