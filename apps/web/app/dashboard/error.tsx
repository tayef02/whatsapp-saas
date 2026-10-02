"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

// এই একটা error.tsx /dashboard এর নিচের সব রুটের (messenger সহ) এরর ধরে — Next.js এর
// error boundary সবসময় নিজের নিচের পুরো সাবট্রি কভার করে, প্রতিটা পেজে আলাদা error.tsx লাগে না
// (শুধু কোনো সাব-রুটের নিজস্ব আলাদা বার্তা লাগলে সেখানে আলাদা error.tsx বসানো যাবে)।
// আসল এরর (res.error.message ইত্যাদি) কখনো ইউজারকে দেখানো হয় না, শুধু console এ লগ হয়
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-light text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-text">একটা সমস্যা হয়েছে</p>
      <p className="max-w-sm text-sm text-text-muted">পেজটা লোড করতে সমস্যা হচ্ছে। একটু পর আবার চেষ্টা করুন, সমস্যা থাকলে সাপোর্টে যোগাযোগ করুন।</p>
      <Button onClick={() => reset()}>আবার চেষ্টা করুন</Button>
    </div>
  );
}
