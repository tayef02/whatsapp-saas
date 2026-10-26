"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import { createEmailContact } from "../actions";

// ম্যানুয়ালি একজন যোগ করা — সম্মতির টিক বাধ্যতামূলক (সার্ভারেও আবার যাচাই হয়)
export default function NewEmailContactForm({ consentText }: { consentText: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createEmailContact(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/email/contacts");
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-4 text-base font-semibold text-text">নতুন ইমেইল কন্টাক্ট</h1>
        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="email" type="email" label="ইমেইল" required placeholder="name@example.com" />
          <Input name="name" type="text" label="নাম (ঐচ্ছিক)" />
          <Input name="tags" type="text" label="ট্যাগ (ঐচ্ছিক)" placeholder="কমা দিয়ে আলাদা করুন" />

          <label className="flex items-start gap-2 rounded-lg border border-border bg-app-bg p-3 text-sm text-text">
            <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
            <span>{consentText}</span>
          </label>

          <Button type="submit" loading={loading}>
            {loading ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
