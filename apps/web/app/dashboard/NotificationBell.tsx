"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { markNotificationRead } from "./notifications-actions";

type Notification = { id: string; title: string; body: string | null };

// আগে প্রতি পেজের উপরে হলুদ ব্যানারের স্তূপ জমতো — এখন টপবারে বেল আইকন + ড্রপডাউন।
// ডাটা শেপ আর markNotificationRead action অপরিবর্তিত (dashboard/layout.tsx থেকেই আসে)
export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const visible = notifications.filter((n) => !dismissed.includes(n.id));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function dismiss(id: string) {
    setDismissed((d) => [...d, id]);
    await markNotificationRead(id);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-text-muted hover:bg-gray-100"
        aria-label="নোটিফিকেশন"
      >
        <Bell className="h-5 w-5" />
        {visible.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">নোটিফিকেশন</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 && <p className="px-4 py-6 text-center text-sm text-text-muted">কোনো নতুন নোটিফিকেশন নেই</p>}
            {visible.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 border-b border-border px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-text">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-text-muted">{n.body}</p>}
                </div>
                <button onClick={() => dismiss(n.id)} className="shrink-0 text-xs text-primary hover:underline">
                  বন্ধ করুন
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
