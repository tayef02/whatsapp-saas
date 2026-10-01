"use client";

import { useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, Button, useToast } from "@/components/ui";
import { updatePassword } from "./actions";

export default function PasswordForm() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await updatePassword(formData);
    setLoading(false);

    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", "পাসওয়ার্ড বদলানো হয়েছে");
    formRef.current?.reset();
  }

  return (
    <Card className="max-w-md">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">পাসওয়ার্ড বদলান</p>
      </div>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-text">নতুন পাসওয়ার্ড</span>
          <input
            name="newPassword"
            type="password"
            minLength={6}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <span className="mt-1 block text-xs text-text-muted">কমপক্ষে ৬ ক্যারেক্টার</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-text">আবার লিখুন</span>
          <input
            name="confirmPassword"
            type="password"
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>
        <Button type="submit" loading={loading} className="self-start">
          বদলান
        </Button>
      </form>
    </Card>
  );
}
