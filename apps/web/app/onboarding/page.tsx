"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "./actions";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createWorkspace(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <h1>আপনার Workspace বানান</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        যেমন আপনার ব্যবসার নাম — এটা দিয়ে পরে আপনার নাম্বার, ক্যাম্পেইন সব ম্যানেজ হবে।
      </p>
      {error && <div className="error">{error}</div>}
      <form action={handleSubmit}>
        <label htmlFor="name">Workspace এর নাম</label>
        <input id="name" name="name" type="text" required placeholder="যেমন: আমার শপ" />

        <button type="submit" disabled={loading}>
          {loading ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
        </button>
      </form>
    </div>
  );
}
