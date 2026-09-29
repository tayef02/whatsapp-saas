"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
import { createNumber } from "../actions";

export default function NewNumberPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createNumber(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/numbers/${result.id}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-text">নতুন নাম্বার যোগ করুন</h1>
        </div>

        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="displayName"
            name="displayName"
            type="text"
            required
            label="নাম্বারের নাম"
            placeholder="যেমন: সেলস নাম্বার"
            helperText="পরে চেনার জন্য একটা সহজ নাম দিন — ফোন নাম্বারটা QR স্ক্যান করার পর অটো বসে যাবে"
          />

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "QR তৈরি হচ্ছে..." : "QR কোড তৈরি করুন"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
