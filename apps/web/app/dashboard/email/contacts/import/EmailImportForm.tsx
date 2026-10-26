"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
import { startEmailImport } from "./actions";

// সম্মতি-চেকবক্সে টিক না দিলে বাটন বন্ধ (সার্ভারেও আবার যাচাই হয়, আর টিক ছাড়া ইম্পোর্টের রো-ই বসে না)
export default function EmailImportForm({ consentText }: { consentText: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const res = await startEmailImport(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    router.push(`/dashboard/email/contacts/import/${res.importId}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-text">ইমেইল কন্টাক্ট ইমপোর্ট</h1>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          CSV বা Excel ফাইল দিন। প্রথম সারি হেডার হতে হবে — ইমেইল কলামের নাম <b>email</b> বা <b>ইমেইল</b>, নামের কলাম <b>name</b> বা <b>নাম</b> (ঐচ্ছিক)। বাকি কলামগুলো টেমপ্লেটে {"{{কলামের নাম}}"} দিয়ে ব্যবহার করা যাবে।
          ডুপ্লিকেট, ভুল ফরম্যাট আর আনসাবস্ক্রাইব/বাউন্স করা ঠিকানা বাদ যাবে — কোনটা কেন বাদ গেছে তা পরের পেজে দেখাবে।
        </p>

        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-text">ফাইল</span>
            <input
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-primary"
            />
          </label>

          <Input name="tag" label="ট্যাগ (ঐচ্ছিক)" placeholder="যেমন: নিউজলেটার ২০২৬" helperText="দিলে ইমপোর্ট হওয়া সবাইকে এই ট্যাগ লাগবে" maxLength={50} />

          <label className="flex items-start gap-2 rounded-lg border border-border bg-app-bg p-3 text-sm text-text">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span>
              {consentText}
              <span className="mt-1 block text-xs text-text-muted">আপনার নাম, ইমেইল ও সময়সহ এই নিশ্চিতকরণ ইম্পোর্টের রেকর্ডে সংরক্ষিত থাকবে।</span>
            </span>
          </label>

          <Button type="submit" loading={loading} disabled={!consent} className="w-full">
            {loading ? "প্রসেস হচ্ছে..." : "ইমপোর্ট শুরু করুন"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
