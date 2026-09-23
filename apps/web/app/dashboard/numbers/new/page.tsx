"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNumber } from "../actions";

export default function NewNumberPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createNumber(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/numbers/${result.id}`);
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>নতুন নাম্বার যোগ করুন</h1>
      {error && <div className="error">{error}</div>}
      <form action={handleSubmit}>
        <label htmlFor="displayName">নাম্বারের নাম</label>
        <input id="displayName" name="displayName" type="text" required placeholder="যেমন: সেলস নাম্বার" />

        <button type="submit" disabled={loading}>
          {loading ? "QR তৈরি হচ্ছে..." : "QR কোড দেখান"}
        </button>
      </form>
    </div>
  );
}
