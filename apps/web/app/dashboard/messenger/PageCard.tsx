"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, PowerOff, Bot } from "lucide-react";
import { Card, Badge, useToast } from "@/components/ui";
import { disconnectPage, toggleMessengerPageBot } from "./connect/actions";

type MessengerPage = { id: string; page_name: string | null; status: string; connected_at: string | null; bot_enabled: boolean };

const statusLabel: Record<string, string> = {
  active: "চালু",
  token_expired: "টোকেনের মেয়াদ শেষ — আবার কানেক্ট করুন",
  disconnected: "ডিসকানেক্টেড",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "success",
  token_expired: "danger",
  disconnected: "neutral",
};

export default function PageCard({ page }: { page: MessengerPage }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [botActive, setBotActive] = useState(page.bot_enabled);

  async function handleDisconnect() {
    if (!confirm(`"${page.page_name}" ডিসকানেক্ট করবেন? Messenger ইনবক্স আর কাজ করবে না।`)) return;
    setBusy(true);
    const res = await disconnectPage(page.id);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "ডিসকানেক্ট করা হয়েছে");
    router.refresh();
  }

  async function handleToggleBot() {
    const next = !botActive;
    setBusy(true);
    setBotActive(next); // optimistic
    const res = await toggleMessengerPageBot(page.id, next);
    setBusy(false);
    if (res.error) {
      setBotActive(!next);
      showToast("error", res.error);
      return;
    }
    showToast("success", next ? "বট চালু করা হয়েছে" : "বট বন্ধ করা হয়েছে");
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{page.page_name || page.id}</p>
            <Badge variant={statusVariant[page.status] ?? "neutral"}>{statusLabel[page.status] ?? page.status}</Badge>
          </div>
        </div>
        {page.status !== "disconnected" && (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-danger-light px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-red-100 disabled:opacity-60"
          >
            <PowerOff className="h-3.5 w-3.5" /> ডিসকানেক্ট
          </button>
        )}
      </div>

      {page.status !== "disconnected" && (
        <button
          onClick={handleToggleBot}
          disabled={busy}
          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            botActive ? "border-primary-light bg-primary-light text-primary" : "border-border bg-gray-50 text-text-muted"
          }`}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Bot className="h-4 w-4" /> {botActive ? "বট চালু" : "বট বন্ধ"}
          </span>
          <span className="text-xs text-text-muted">{botActive ? "এআই চ্যাটবট রিপ্লাই দিচ্ছে" : "ক্লিক করে চালু করুন"}</span>
        </button>
      )}
    </Card>
  );
}
