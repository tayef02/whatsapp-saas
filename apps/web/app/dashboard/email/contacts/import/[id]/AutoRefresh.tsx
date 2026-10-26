"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ইম্পোর্ট চলাকালীন প্রতি ২ সেকেন্ডে পেজের সার্ভার-ডাটা রিফ্রেশ (শেষ হলে সার্ভার আর এটা রেন্ডার করে না)
export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
