"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, PowerOff, Trash2, Bot } from "lucide-react";
import { Card, Badge, Button, Modal, useToast } from "@/components/ui";
import { disconnectNumber, deleteNumber, toggleBot } from "./actions";

type NumberRow = {
  id: string;
  display_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  daily_message_limit: number;
  connected_at: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  connecting: "QR অপেক্ষায়",
  online: "কানেক্টেড",
  offline: "ডিসকানেক্টেড",
  banned: "ব্যান হয়েছে",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  connecting: "info",
  online: "success",
  offline: "neutral",
  banned: "danger",
};

// worker এর দৈনিক ডিসপ্যাচ ফাংশনের একই warmup সিঁড়ি (migration 0010:
// dispatch_scheduled_messages) — শুধু দেখানোর জন্য, ওই SQL ফাংশনই আসল সীমা এনফোর্স করে
function getWarmupInfo(connectedAt: string | null, configuredLimit: number): { label: string; effectiveLimit: number } {
  if (!connectedAt) return { label: "ওয়ার্ম-আপ (১-২০/দিন)", effectiveLimit: Math.min(configuredLimit, 20) };
  const days = (Date.now() - new Date(connectedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 2) return { label: "ওয়ার্ম-আপ ১ম ধাপ", effectiveLimit: Math.min(configuredLimit, 20) };
  if (days < 4) return { label: "ওয়ার্ম-আপ ২য় ধাপ", effectiveLimit: Math.min(configuredLimit, 50) };
  if (days < 7) return { label: "ওয়ার্ম-আপ ৩য় ধাপ", effectiveLimit: Math.min(configuredLimit, 100) };
  if (days < 14) return { label: "ওয়ার্ম-আপ ৪র্থ ধাপ", effectiveLimit: Math.min(configuredLimit, 150) };
  return { label: "ওয়ার্ম-আপ শেষ", effectiveLimit: configuredLimit };
}

export default function NumbersList({
  numbers,
  sentTodayByNumber,
  botActiveByNumber,
}: {
  numbers: NumberRow[];
  sentTodayByNumber: Record<string, number>;
  botActiveByNumber: Record<string, boolean>;
}) {
  const [qrNumberId, setQrNumberId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<NumberRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NumberRow | null>(null);

  const qrNumber = numbers.find((n) => n.id === qrNumberId) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {numbers.map((n) => (
          <NumberCard
            key={n.id}
            number={n}
            sentToday={sentTodayByNumber[n.id] ?? 0}
            botActive={botActiveByNumber[n.id] ?? true}
            onShowQr={() => setQrNumberId(n.id)}
            onDisconnect={() => setDisconnectTarget(n)}
            onDelete={() => setDeleteTarget(n)}
          />
        ))}
      </div>

      <QrModal number={qrNumber} onClose={() => setQrNumberId(null)} />
      <DisconnectModal number={disconnectTarget} onClose={() => setDisconnectTarget(null)} />
      <DeleteModal number={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </>
  );
}

function NumberCard({
  number,
  sentToday,
  botActive,
  onShowQr,
  onDisconnect,
  onDelete,
}: {
  number: NumberRow;
  sentToday: number;
  botActive: boolean;
  onShowQr: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(botActive);

  const warmup = getWarmupInfo(number.connected_at, number.daily_message_limit);
  const usagePct = warmup.effectiveLimit > 0 ? Math.min(100, Math.round((sentToday / warmup.effectiveLimit) * 100)) : 0;

  async function handleToggleBot() {
    const next = !active;
    setBusy(true);
    setActive(next); // optimistic
    const res = await toggleBot(number.id, next);
    setBusy(false);
    if (res.error) {
      setActive(!next);
      showToast("error", res.error);
      return;
    }
    showToast("success", next ? "বট চালু করা হয়েছে" : "বট বন্ধ করা হয়েছে");
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text">{number.display_name}</p>
          <p className="text-xs text-text-muted">{number.phone_number ?? "নাম্বার এখনো কানেক্ট হয়নি"}</p>
        </div>
        <Badge variant={statusVariant[number.status] ?? "neutral"}>{statusLabel[number.status] ?? number.status}</Badge>
      </div>

      {number.status === "online" && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
              <span>{warmup.label}</span>
              <span>
                {sentToday} / {warmup.effectiveLimit} আজ
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${usagePct >= 90 ? "bg-danger" : usagePct >= 70 ? "bg-warning" : "bg-primary"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleToggleBot}
            disabled={busy}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              active ? "border-primary-light bg-primary-light text-primary" : "border-border bg-gray-50 text-text-muted"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Bot className="h-4 w-4" /> এআই চ্যাটবট
            </span>
            <span className="font-medium">{active ? "চালু" : "বন্ধ"}</span>
          </button>
        </>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {number.status === "connecting" && (
          <Button variant="secondary" className="flex-1" onClick={onShowQr}>
            <QrCode className="h-4 w-4" /> QR দেখান
          </Button>
        )}
        {number.status === "online" && (
          <Button variant="secondary" className="flex-1" onClick={onDisconnect}>
            <PowerOff className="h-4 w-4" /> ডিসকানেক্ট
          </Button>
        )}
        {(number.status === "offline" || number.status === "banned") && (
          <Button variant="danger" className="flex-1" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> মুছে ফেলুন
          </Button>
        )}
      </div>
    </Card>
  );
}

function QrModal({ number, onClose }: { number: NumberRow | null; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<NumberRow | null>(number);

  useEffect(() => {
    setData(number);
  }, [number]);

  useEffect(() => {
    if (!data || data.status === "online") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/numbers/${data.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setData((prev) => (prev ? { ...prev, ...fresh } : prev));
        if (fresh.status === "online") {
          router.refresh();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data, router]);

  if (!number || !data) return null;

  return (
    <Modal open={Boolean(number)} onClose={onClose} title={`QR কোড — ${data.display_name}`}>
      <div className="flex flex-col items-center gap-3 text-center">
        {data.status === "connecting" && data.qr_code && (
          <img src={data.qr_code} alt="QR কোড" className="h-64 w-64 rounded-lg border border-border" />
        )}
        {data.status === "connecting" && !data.qr_code && <p className="py-10 text-sm text-text-muted">QR কোড তৈরি হচ্ছে...</p>}
        {data.status === "online" && <p className="py-4 text-sm font-medium text-success">কানেক্ট হয়ে গেছে — {data.phone_number}</p>}
        <p className="text-xs text-text-muted">WhatsApp থেকে "লিঙ্কড ডিভাইস" দিয়ে এই কোড স্ক্যান করুন</p>
      </div>
    </Modal>
  );
}

function DisconnectModal({ number, onClose }: { number: NumberRow | null; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!number) return;
    setBusy(true);
    const res = await disconnectNumber(number.id);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "নাম্বার ডিসকানেক্ট করা হয়েছে");
    onClose();
    router.refresh();
  }

  return (
    <Modal open={Boolean(number)} onClose={onClose} title="নাম্বার ডিসকানেক্ট করবেন?">
      <p className="mb-4 text-sm text-text-muted">
        "{number?.display_name}" ডিসকানেক্ট হয়ে যাবে — আবার ব্যবহার করতে হলে QR স্ক্যান করে নতুন করে কানেক্ট করতে হবে।
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          বাতিল
        </Button>
        <Button variant="danger" loading={busy} onClick={handleConfirm}>
          ডিসকানেক্ট করুন
        </Button>
      </div>
    </Modal>
  );
}

function DeleteModal({ number, onClose }: { number: NumberRow | null; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!number) return;
    setBusy(true);
    const res = await deleteNumber(number.id);
    setBusy(false);
    if (res.error) {
      showToast("error", res.error);
      return;
    }
    showToast("success", "নাম্বার মুছে ফেলা হয়েছে");
    onClose();
    router.refresh();
  }

  return (
    <Modal open={Boolean(number)} onClose={onClose} title="নাম্বার মুছে ফেলবেন?">
      <p className="mb-4 text-sm text-text-muted">
        "{number?.display_name}" পুরোপুরি মুছে যাবে (কথোপকথন হিস্ট্রিসহ)। এটা ফেরানো যাবে না।
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          বাতিল
        </Button>
        <Button variant="danger" loading={busy} onClick={handleConfirm}>
          মুছে ফেলুন
        </Button>
      </div>
    </Modal>
  );
}
