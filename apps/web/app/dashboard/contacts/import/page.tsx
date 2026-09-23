"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startImport } from "./actions";

export default function ImportContactsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; duplicate: number; invalid: number } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await startImport(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.done) {
      setResult({ added: res.added, duplicate: res.duplicate, invalid: res.invalid });
      return;
    }
    router.push(`/dashboard/contacts/import/${res.importJobId}`);
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>কন্টাক্ট ইম্পোর্ট করুন</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        CSV বা Excel ফাইল দিন। প্রথম সারি হেডার (phone/mobile/নাম্বার, name/নাম) হতে হবে। নাম্বার যেকোনো ফরম্যাটে
        (01XXX, +8801XXX ইত্যাদি) দিলে চলবে।
      </p>
      {error && <div className="error">{error}</div>}

      {result ? (
        <div>
          <p>
            ✅ {result.added} জন যোগ হয়েছে
            <br />
            ⏭️ {result.duplicate} জন ডুপ্লিকেট (বাদ গেছে)
            <br />
            ⚠️ {result.invalid} টা নাম্বার ইনভ্যালিড (বাদ গেছে)
          </p>
          <button onClick={() => router.push("/dashboard/contacts")}>কন্টাক্ট লিস্টে যান</button>
        </div>
      ) : (
        <form action={handleSubmit}>
          <label htmlFor="file">ফাইল</label>
          <input id="file" name="file" type="file" accept=".csv,.xlsx,.xls" required />

          <label htmlFor="tag">ট্যাগ (ঐচ্ছিক, সবাইকে এই ট্যাগ লাগবে)</label>
          <input id="tag" name="tag" type="text" placeholder="যেমন: ঈদ ক্যাম্পেইন ২০২৬" />

          <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "প্রসেস হচ্ছে..." : "ইম্পোর্ট শুরু করুন"}
          </button>
        </form>
      )}
    </div>
  );
}
