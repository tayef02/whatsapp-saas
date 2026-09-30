"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Send, Clock } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import { sendAgentReply } from "./actions";

type Message = {
  id: string;
  direction: string;
  sender_type: string;
  content: string;
  media_type: string | null;
  created_at: string;
};

const senderLabel: Record<string, string> = {
  customer: "কাস্টমার",
  bot: "Auto-Reply",
  agent: "আপনি",
};

export default function ConversationThread({
  conversationId,
  contactLabel,
  pageLabel,
  windowHoursLeft,
  messages,
}: {
  conversationId: string;
  contactLabel: string;
  pageLabel: string;
  windowHoursLeft: number;
  messages: Message[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowOpen = windowHoursLeft > 0;

  async function handleSend(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await sendAgentReply(conversationId, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard/messenger/inbox"
            className="shrink-0 rounded-lg p-1 text-text-muted hover:bg-gray-100 md:hidden"
            aria-label="তালিকায় ফিরুন"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{contactLabel}</p>
            <p className="truncate text-xs text-text-muted">{pageLabel}</p>
          </div>
        </div>
        <Badge variant={windowOpen ? "success" : "neutral"} className="shrink-0">
          <Clock className="h-3 w-3" />
          {windowOpen ? `২৪ ঘণ্টার উইন্ডো: ${Math.round(windowHoursLeft)} ঘণ্টা বাকি` : "উইন্ডো শেষ"}
        </Badge>
      </div>

      {error && <p className="shrink-0 bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded-xl px-3 py-2 ${
              m.direction === "inbound" ? "self-start border border-border bg-card" : "self-end bg-[#dcf8c6]"
            }`}
          >
            <p className="mb-0.5 text-[11px] text-text-muted">{senderLabel[m.sender_type] ?? m.sender_type}</p>
            <p className="text-sm break-words whitespace-pre-wrap text-text">{m.content}</p>
            {m.media_type && <p className="mt-1 text-[11px] text-text-muted">(আসল ফাইল ডাউনলোড শীঘ্রই আসছে)</p>}
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-text-muted">এখনো কোনো মেসেজ নেই।</p>}
      </div>

      {windowOpen ? (
        <form action={handleSend} className="flex shrink-0 gap-2 border-t border-border p-3">
          <input
            type="text"
            name="text"
            placeholder="রিপ্লাই লিখুন..."
            required
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" disabled={busy}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className="shrink-0 border-t border-border bg-app-bg p-3 text-center text-xs text-text-muted">
          ২৪ ঘণ্টার মেসেজিং উইন্ডো শেষ হয়ে গেছে — কাস্টমার আবার মেসেজ না করা পর্যন্ত রিপ্লাই পাঠানো যাবে না। (Human Agent ট্যাগ দিয়ে উইন্ডো
          বাড়ানোর ফিচার শীঘ্রই আসছে।)
        </div>
      )}
    </Card>
  );
}
