"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Clock, Image as ImageIcon, FileText, Video, Music, Download } from "lucide-react";
import { Card, Badge, Button, Modal } from "@/components/ui";
import { sendAgentReply, setMessengerConversationStatus, markMessengerConversationRead } from "./actions";

type Message = {
  id: string;
  direction: string;
  sender_type: string;
  content: string;
  media_path: string | null;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
};

const senderLabel: Record<string, string> = {
  customer: "কাস্টমার",
  bot: "Auto-Reply",
  agent: "আপনি",
};

const statusLabel: Record<string, string> = {
  active: "চলমান",
  handed_off: "এজেন্ট দরকার",
  resolved: "সমাধান হয়েছে",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "info",
  handed_off: "danger",
  resolved: "success",
};

const mediaIcon: Record<string, React.ElementType> = {
  document: FileText,
  video: Video,
  audio: Music,
};

const mediaLabel: Record<string, string> = {
  document: "ডকুমেন্ট",
  video: "ভিডিও",
  audio: "অডিও",
};

export default function ConversationThread({
  conversationId,
  status,
  contactLabel,
  pageLabel,
  botEnabled,
  windowHoursLeft,
  humanAgentHoursLeft,
  messages,
}: {
  conversationId: string;
  status: string;
  contactLabel: string;
  pageLabel: string;
  botEnabled: boolean;
  windowHoursLeft: number;
  humanAgentHoursLeft: number;
  messages: Message[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // খুললেই "পঠিত" — ফলাফল UI তে লাগে না, ব্যর্থ হলে সার্ভারে লগ হয়
  useEffect(() => {
    void markMessengerConversationRead(conversationId);
  }, [conversationId]);

  const windowOpen = windowHoursLeft > 0;
  // ২৪ ঘণ্টার RESPONSE উইন্ডো শেষ হলেও ৭ দিন পর্যন্ত Human Agent ট্যাগ দিয়ে রিপ্লাই পাঠানো
  // যায় — তাই রিপ্লাই বক্স তখনও খোলা থাকে, শুধু একটা নোট দেখানো হয় (process-messenger-reply.ts
  // send-time এ আবার এই একই উইন্ডো-লজিক যাচাই করে)
  const humanAgentWindowOpen = humanAgentHoursLeft > 0;
  const replyBoxOpen = windowOpen || humanAgentWindowOpen;

  async function handleSend(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await sendAgentReply(conversationId, formData);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleStatus(newStatus: "active" | "resolved") {
    setBusy(true);
    setError(null);
    const res = await setMessengerConversationStatus(conversationId, newStatus);
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
        <div className="flex shrink-0 items-center gap-1.5">
          {!botEnabled && <Badge variant="neutral">বট বন্ধ</Badge>}
          <Badge variant={statusVariant[status] ?? "neutral"}>{statusLabel[status] ?? status}</Badge>
          <Badge variant={windowOpen ? "success" : humanAgentWindowOpen ? "warning" : "neutral"}>
            <Clock className="h-3 w-3" />
            {windowOpen
              ? `উইন্ডো: ${Math.round(windowHoursLeft).toLocaleString("bn-BD")} ঘণ্টা বাকি`
              : humanAgentWindowOpen
                ? `Human Agent: ${Math.ceil(humanAgentHoursLeft / 24).toLocaleString("bn-BD")} দিন বাকি`
                : "উইন্ডো শেষ"}
          </Badge>
        </div>
      </div>

      {!botEnabled && (
        <p className="shrink-0 bg-app-bg px-3 py-2 text-xs text-text-muted">
          এই পেজের বট বন্ধ আছে — কাস্টমারের মেসেজ সেভ হচ্ছে, কিন্তু AI অটো-রিপ্লাই পাঠাচ্ছে না। Messenger পেজ থেকে বট আবার চালু করতে পারেন।
        </p>
      )}

      <div className="flex shrink-0 flex-wrap gap-2 border-b border-border p-3">
        {status === "handed_off" && (
          <Button variant="secondary" disabled={busy} onClick={() => handleStatus("active")}>
            Auto-Reply আবার চালু করুন
          </Button>
        )}
        {status !== "resolved" && (
          <Button variant="secondary" disabled={busy} onClick={() => handleStatus("resolved")}>
            সমাধান হয়েছে
          </Button>
        )}
      </div>

      {error && <p className="shrink-0 bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m) => {
          const isImage = m.media_type === "image";
          const MediaIcon = m.media_type ? mediaIcon[m.media_type] : null;
          return (
            <div
              key={m.id}
              className={`max-w-[75%] rounded-xl px-3 py-2 ${
                // WhatsApp ইনবক্সে outbound বাবল #dcf8c6 (আসল WhatsApp অ্যাপের সবুজ) — এখানে
                // ভুলে সেই একই রং কপি হয়ে গিয়েছিল। Messenger নিজস্ব নীল (info টোকেন, Badge/
                // চ্যানেল সুইচারেও Messenger=নীল), WhatsApp-এর সবুজ না
                m.direction === "inbound" ? "self-start border border-border bg-card" : "self-end bg-info-light"
              }`}
            >
              <p className="mb-0.5 text-[11px] text-text-muted">{senderLabel[m.sender_type] ?? m.sender_type}</p>

              {m.media_type &&
                (isImage ? (
                  m.media_url ? (
                    <button type="button" onClick={() => setLightboxUrl(m.media_url)} className="mb-1.5 block">
                      <img src={m.media_url} alt={m.content || "ছবি"} className="max-h-60 max-w-60 cursor-zoom-in rounded-lg object-contain" />
                    </button>
                  ) : (
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                      <ImageIcon className="h-3.5 w-3.5" /> ছবি ডাউনলোড হচ্ছে...
                    </p>
                  )
                ) : (
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs text-info">
                    {MediaIcon && <MediaIcon className="h-3.5 w-3.5" />}
                    {mediaLabel[m.media_type] ?? m.media_type}
                    {m.media_url ? (
                      <a href={m.media_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        <Download className="h-3 w-3" /> ডাউনলোড
                      </a>
                    ) : (
                      <span className="text-text-muted">(ডাউনলোড হচ্ছে...)</span>
                    )}
                  </div>
                ))}

              {m.content && <p className="text-sm break-words whitespace-pre-wrap text-text">{m.content}</p>}
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-sm text-text-muted">এখনো কোনো মেসেজ নেই।</p>}
      </div>

      {replyBoxOpen ? (
        <>
          {!windowOpen && humanAgentWindowOpen && (
            <p className="shrink-0 bg-warning-light px-3 py-2 text-xs text-warning">
              Human Agent মোড (৭ দিন পর্যন্ত, প্রোমোশন ছাড়া) — ২৪ ঘণ্টার স্বাভাবিক উইন্ডো শেষ, কিন্তু এজেন্ট হিসেবে এখনও রিপ্লাই পাঠানো যাবে। Meta
              এই ফিচার এখনও অনুমোদন না করলে পাঠানো ব্যর্থ হতে পারে (নোটিফিকেশনে জানানো হবে)।
            </p>
          )}
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
        </>
      ) : (
        <div className="shrink-0 border-t border-border bg-app-bg p-3 text-center text-xs text-text-muted">
          ৭ দিনের মেসেজিং উইন্ডো শেষ হয়ে গেছে — কাস্টমার আবার মেসেজ না করা পর্যন্ত রিপ্লাই পাঠানো যাবে না।
        </div>
      )}

      <Modal open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} title="ছবি">
        {lightboxUrl && <img src={lightboxUrl} alt="ছবি" className="max-h-[70vh] w-full rounded-lg object-contain" />}
      </Modal>
    </Card>
  );
}
