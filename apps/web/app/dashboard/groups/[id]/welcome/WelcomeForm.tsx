"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Textarea, Button, useToast } from "@/components/ui";
import { updateWelcomeSettings } from "../../actions";

export default function WelcomeForm({ groupId, initialEnabled, initialMessage }: { groupId: string; initialEnabled: boolean; initialMessage: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const res = await updateWelcomeSettings(groupId, enabled, message);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "সেভ হয়েছে");
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <p className="mb-3 text-sm font-semibold text-text">ওয়েলকাম মেসেজ</p>

      <label className="mb-3 flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        নতুন মেম্বার জয়েন করলে ওয়েলকাম মেসেজ পাঠাবে
      </label>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="যেমন: {{group_name}} গ্রুপে স্বাগতম! গ্রুপ রুলস মেনে চলুন। ইনভাইট লিংক: {{invite_link}}"
        helperText='প্লেসহোল্ডার: {{group_name}}, {{invite_link}} (সারাংশ ট্যাব থেকে "ইনভাইট লিংক আনুন" চাপলে বসবে)'
      />

      <Button disabled={busy} onClick={handleSave} className="mt-3">
        সেভ করুন
      </Button>
    </Card>
  );
}
