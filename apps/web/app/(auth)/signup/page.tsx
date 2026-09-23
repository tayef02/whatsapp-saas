"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "../actions";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1>ইমেইল চেক করুন</h1>
        <p>আপনার ইমেইলে একটা কনফার্মেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে অ্যাকাউন্ট কনফার্ম করুন, তারপর লগইন করুন।</p>
        <div className="switch">
          <Link href="/login">লগইন পেজে যান</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>নতুন অ্যাকাউন্ট বানান</h1>
      {error && <div className="error">{error}</div>}
      <form action={handleSubmit}>
        <label htmlFor="fullName">আপনার নাম</label>
        <input id="fullName" name="fullName" type="text" required />

        <label htmlFor="email">ইমেইল</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">পাসওয়ার্ড</label>
        <input id="password" name="password" type="password" minLength={6} required />

        <button type="submit" disabled={loading}>
          {loading ? "তৈরি হচ্ছে..." : "সাইনআপ"}
        </button>
      </form>
      <div className="switch">
        অ্যাকাউন্ট আছে? <Link href="/login">লগইন করুন</Link>
      </div>
    </div>
  );
}
