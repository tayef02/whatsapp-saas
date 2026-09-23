"use client";

import { useEffect, useState } from "react";

type NumberData = {
  id: string;
  status: string;
  qr_code: string | null;
  phone_number: string | null;
  display_name: string;
};

const statusLabel: Record<string, string> = {
  connecting: "QR স্ক্যান করার অপেক্ষায়",
  online: "অনলাইন — কানেক্ট হয়ে গেছে",
  offline: "অফলাইন",
  banned: "এই নাম্বার ব্যান হয়েছে",
};

// প্রতি ৩ সেকেন্ডে স্ট্যাটাস চেক করে — QR কোড রিফ্রেশ হলে বা কানেক্ট হয়ে গেলে অটো আপডেট হবে
export default function NumberStatus({ initial }: { initial: NumberData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    if (data.status === "online") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/numbers/${data.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data.status, data.id]);

  return (
    <div className="auth-card" style={{ margin: "0 auto", textAlign: "center" }}>
      <h1>{data.display_name}</h1>
      <p>{statusLabel[data.status] ?? data.status}</p>

      {data.status === "connecting" && data.qr_code && (
        <img src={data.qr_code} alt="QR কোড" style={{ width: 260, height: 260, margin: "16px auto" }} />
      )}

      {data.status === "connecting" && !data.qr_code && <p style={{ color: "#666" }}>QR কোড তৈরি হচ্ছে...</p>}

      {data.status === "online" && <p style={{ color: "#166534" }}>{data.phone_number}</p>}
    </div>
  );
}
