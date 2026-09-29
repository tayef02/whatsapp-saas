"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, Input, Button, useToast } from "@/components/ui";
import { updateGroupFilters } from "../../actions";

export default function FiltersForm({
  initialBannedWords,
  initialBannedLinkPatterns,
}: {
  initialBannedWords: string[];
  initialBannedLinkPatterns: string[];
}) {
  const { showToast } = useToast();
  const [wordsText, setWordsText] = useState(initialBannedWords.join(", "));
  const [linksText, setLinksText] = useState(initialBannedLinkPatterns.join(", "));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const bannedWords = wordsText.split(",").map((w) => w.trim()).filter(Boolean);
    const bannedLinkPatterns = linksText.split(",").map((w) => w.trim()).filter(Boolean);
    const res = await updateGroupFilters(bannedWords, bannedLinkPatterns);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "সেভ হয়েছে");
  }

  return (
    <Card className="max-w-xl">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">স্প্যাম/ব্যানড-ওয়ার্ড ফিল্টার</p>
      </div>
      <p className="mb-4 text-xs text-text-muted">
        এই সেটিং আপনার workspace-এর <strong>সব গ্রুপে</strong> প্রযোজ্য (এই গ্রুপে আলাদা না)। নিচের যেকোনো শব্দ/লিংক-প্যাটার্ন
        গ্রুপ মেসেজে মিললে — bot গ্রুপে অ্যাডমিন থাকলে অটোমেটিক ডিলিট হবে, না থাকলে ড্যাশবোর্ডে নোটিফিকেশন যাবে।
      </p>
      <div className="flex flex-col gap-4">
        <Input
          label="ব্যানড ওয়ার্ড (কমা দিয়ে আলাদা করুন)"
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          placeholder="যেমন: গালি১, গালি২"
        />
        <Input
          label="ব্যানড লিংক প্যাটার্ন (কমা দিয়ে আলাদা করুন)"
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          placeholder="যেমন: bit.ly, t.me"
        />
        <Button disabled={busy} onClick={handleSave} className="self-start">
          সেভ করুন
        </Button>
      </div>
    </Card>
  );
}
