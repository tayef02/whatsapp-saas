"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { Card, Input, Button, useToast } from "@/components/ui";
import { updateFullName } from "./actions";

export default function ProfileForm({ fullName }: { fullName: string }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await updateFullName(formData);
    setLoading(false);

    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", "নাম বদলানো হয়েছে");
  }

  return (
    <Card className="max-w-md">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">প্রোফাইল</p>
      </div>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <Input name="fullName" label="আপনার নাম" defaultValue={fullName} required />
        <Button type="submit" loading={loading} className="self-start">
          সেভ করুন
        </Button>
      </form>
    </Card>
  );
}
