"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, Badge } from "@/components/ui";

type NumberData = {
  id: string;
  status: string;
  qr_code: string | null;
  phone_number: string | null;
  display_name: string;
};

const statusLabel: Record<string, string> = {
  connecting: "QR স্ক্যান করার অপেক্ষায়",
  online: "অনলাইন — কানেক্ট হয়ে গেছে",
  offline: "অফলাইন",
  banned: "এই নাম্বার ব্যান হয়েছে",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  connecting: "info",
  online: "success",
  offline: "neutral",
  banned: "danger",
};

// প্রতি ৩ সেকেন্ডে স্ট্যাটাস চেক করে — QR কোড রিফ্রেশ হলে বা কানেক্ট হয়ে গেলে অটো আপডেট হবে
export default function NumberStatus({ initial }: { initial: NumberData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    if (data.status === "online") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/numbers/${data.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data.status, data.id]);

  return (
    <div className="mx-auto max-w-md">
      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="text-base font-semibold text-text">{data.display_name}</p>
        <Badge variant={statusVariant[data.status] ?? "neutral"}>{statusLabel[data.status] ?? data.status}</Badge>

        {data.status === "connecting" && data.qr_code && (
          <img src={data.qr_code} alt="QR কোড" className="h-64 w-64 rounded-lg border border-border" />
        )}

        {data.status === "connecting" && !data.qr_code && <p className="py-10 text-sm text-text-muted">QR কোড তৈরি হচ্ছে...</p>}

        {data.status === "connecting" && data.qr_code && (
          <p className="text-xs text-text-muted">WhatsApp থেকে "লিঙ্কড ডিভাইস" দিয়ে এই কোড স্ক্যান করুন</p>
        )}

        {data.status === "online" && (
          <>
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" /> {data.phone_number}
            </p>
            <p className="text-xs text-text-muted">
              AI Chatbot এই নাম্বারে সবসময় চালু আছে —{" "}
              <Link href="/dashboard/ai-chatbot" className="text-primary hover:underline">
                সেটিংস (system prompt, knowledge base) এখানে
              </Link>
            </p>
            <Link href="/dashboard/numbers" className="mt-2 text-sm font-medium text-primary hover:underline">
              সব নাম্বার দেখুন →
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
