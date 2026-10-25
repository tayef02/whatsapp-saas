"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { sendTestEmail } from "./actions";

// নিজের অ্যাকাউন্টের ইমেইলে একটা টেস্ট ইমেইল — সেটআপ ঠিক আছে কিনা (SPF/DKIM/DMARC, আনসাবস্ক্রাইব
// লিংক, ফুটার) নিজের চোখে দেখার জন্য
export default function TestEmailCard({ ready, canEdit, accountEmail }: { ready: boolean; canEdit: boolean; accountEmail: string }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    const result = await sendTestEmail();
    setLoading(false);

    if (result.error) showToast("error", result.error);
    else showToast("success", result.notice ?? "পাঠানো হচ্ছে");
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Send className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">টেস্ট ইমেইল</p>
      </div>
      <p className="mb-3 text-sm text-text-muted">
        আপনার অ্যাকাউন্টের ঠিকানায় ({accountEmail}) একটা টেস্ট ইমেইল পাঠান। ২৪ ঘণ্টায় সর্বোচ্চ ৫টা।
        টেস্ট ইমেইলের আনসাবস্ক্রাইব লিংক সত্যিই কাজ করে — চাপলে এই ঠিকানা আপনার তালিকায় ব্লক হয়ে যাবে।
      </p>
      <Button onClick={handleSend} loading={loading} disabled={!ready || !canEdit}>
        টেস্ট ইমেইল পাঠান
      </Button>
      {!ready && <p className="mt-2 text-xs text-text-muted">আগে উপরের চেকলিস্টের সবগুলো ধাপ সম্পন্ন করুন।</p>}
    </Card>
  );
}
