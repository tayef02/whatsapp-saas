"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<{ showToast: (kind: ToastKind, message: string) => void } | null>(null);

// server action এর ফলাফল দেখানোর জন্য — window.alert() এর বদলে এখন থেকে এটা ব্যবহার হবে।
// dashboard layout এ একবার <ToastProvider> বসালেই যেকোনো পেজ থেকে useToast() দিয়ে কল করা যায়
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
              t.kind === "success" ? "bg-success" : "bg-danger"
            }`}
          >
            {t.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast অবশ্যই <ToastProvider> এর ভেতরে ব্যবহার করতে হবে");
  return ctx;
}
