"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, MailCheck } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold text-primary">WhatsApp SaaS</span>
        </div>

        {done ? (
          <Card className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
                <MailCheck className="h-6 w-6" />
              </div>
            </div>
            <h1 className="mb-2 text-base font-semibold text-text">ইমেইল চেক করুন</h1>
            <p className="mb-4 text-sm text-text-muted">
              ইমেইলটা আমাদের সিস্টেমে থাকলে একটা পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে নতুন পাসওয়ার্ড
              বসান।
            </p>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              লগইন পেজে ফিরুন
            </Link>
          </Card>
        ) : (
          <Card>
            <h1 className="mb-1 text-base font-semibold text-text">পাসওয়ার্ড ভুলে গেছেন?</h1>
            <p className="mb-4 text-sm text-text-muted">আপনার ইমেইল দিন, একটা রিসেট লিংক পাঠিয়ে দিচ্ছি।</p>
            {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

            <form action={handleSubmit} className="flex flex-col gap-4">
              <Input id="email" name="email" type="email" label="ইমেইল" required />
              <Button type="submit" loading={loading} className="w-full">
                {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-text-muted">
              মনে পড়েছে?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                লগইন করুন
              </Link>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
