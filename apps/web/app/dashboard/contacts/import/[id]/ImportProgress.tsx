"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, SkipForward, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";

type ImportData = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  total_rows: number;
  processed_rows: number;
  added_count: number;
  duplicate_count: number;
  invalid_count: number;
  error_message: string | null;
};

const statusLabel: Record<string, string> = {
  pending: "শুরু হচ্ছে...",
  processing: "প্রসেস হচ্ছে...",
  done: "শেষ হয়েছে",
  failed: "ব্যর্থ হয়েছে",
};

export default function ImportProgress({ initial }: { initial: ImportData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    if (data.status === "done" || data.status === "failed") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/contacts/imports/${data.id}`);
      if (res.ok) setData(await res.json());
    }, 2000);

    return () => clearInterval(interval);
  }, [data.status, data.id]);

  const percent = data.total_rows > 0 ? Math.round((data.processed_rows / data.total_rows) * 100) : 0;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-1 text-base font-semibold text-text">ইমপোর্ট প্রগ্রেস</h1>
        <p className="mb-3 text-sm text-text-muted">{statusLabel[data.status]}</p>

        {(data.status === "pending" || data.status === "processing") && (
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}

        <p className="mb-3 text-xs text-text-muted">
          {data.processed_rows} / {data.total_rows} রো প্রসেস হয়েছে
        </p>

        {data.status === "done" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-app-bg p-3 text-sm">
              <span className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> {data.added_count} জন যোগ হয়েছে
              </span>
              <span className="flex items-center gap-2 text-text-muted">
                <SkipForward className="h-4 w-4" /> {data.duplicate_count} জন ডুপ্লিকেট (বাদ গেছে)
              </span>
              <span className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" /> {data.invalid_count} টা নাম্বার ইনভ্যালিড (বাদ গেছে)
              </span>
            </div>
            <Link href="/dashboard/contacts" className="text-sm font-medium text-primary hover:underline">
              কন্টাক্ট লিস্টে যান →
            </Link>
          </div>
        )}

        {data.status === "failed" && (
          <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{data.error_message ?? "কিছু একটা ভুল হয়েছে"}</p>
        )}
      </Card>
    </div>
  );
}
