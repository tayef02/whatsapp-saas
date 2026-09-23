"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>ইম্পোর্ট প্রগ্রেস</h1>
      <p>{statusLabel[data.status]}</p>

      {(data.status === "pending" || data.status === "processing") && (
        <div style={{ background: "#eee", borderRadius: 8, overflow: "hidden", height: 10, marginBottom: 12 }}>
          <div style={{ width: `${percent}%`, background: "#16a34a", height: "100%" }} />
        </div>
      )}

      <p style={{ fontSize: 13, color: "#666" }}>
        {data.processed_rows} / {data.total_rows} রো প্রসেস হয়েছে
      </p>

      {data.status === "done" && (
        <div>
          <p>
            ✅ {data.added_count} জন যোগ হয়েছে
            <br />
            ⏭️ {data.duplicate_count} জন ডুপ্লিকেট (বাদ গেছে)
            <br />
            ⚠️ {data.invalid_count} টা নাম্বার ইনভ্যালিড (বাদ গেছে)
          </p>
          <Link href="/dashboard/contacts">কন্টাক্ট লিস্টে যান →</Link>
        </div>
      )}

      {data.status === "failed" && <div className="error">{data.error_message ?? "কিছু একটা ভুল হয়েছে"}</div>}
    </div>
  );
}
