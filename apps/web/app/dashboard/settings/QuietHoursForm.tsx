"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Card, Select, Button, useToast } from "@/components/ui";
import { updateQuietHours } from "./actions";

export default function QuietHoursForm({ startHour, endHour }: { startHour: number; endHour: number }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await updateQuietHours(formData);
    setLoading(false);

    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", "সেভ হয়েছে");
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card className="max-w-md">
      <div className="mb-1 flex items-center gap-2">
        <Clock className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">পাঠানোর সময়সীমা</p>
      </div>
      <p className="mb-4 text-xs text-text-muted">এই সময়ের মধ্যে কোনো ক্যাম্পেইন মেসেজ পাঠানো হবে না (Asia/Dhaka সময় অনুযায়ী)।</p>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Select name="quietStart" label="বন্ধ শুরু হবে" defaultValue={startHour}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </Select>

          <Select name="quietEnd" label="আবার শুরু হবে" defaultValue={endHour}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" loading={loading} className="self-start">
          সেভ করুন
        </Button>
      </form>
    </Card>
  );
}
