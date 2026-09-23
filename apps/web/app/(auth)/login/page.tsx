"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <h1>লগইন করুন</h1>
      {error && <div className="error">{error}</div>}
      <form action={handleSubmit}>
        <label htmlFor="email">ইমেইল</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">পাসওয়ার্ড</label>
        <input id="password" name="password" type="password" required />

        <button type="submit" disabled={loading}>
          {loading ? "লগইন হচ্ছে..." : "লগইন"}
        </button>
      </form>
      <div className="switch">
        অ্যাকাউন্ট নেই? <Link href="/signup">সাইনআপ করুন</Link>
      </div>
    </div>
  );
}
