"use client";

import { useState } from "react";
import { updateQuietHours } from "./actions";

export default function QuietHoursForm({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSaved(false);
    const result = await updateQuietHours(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="auth-card" style={{ margin: 0 }}>
      <h1>পাঠানোর সময়সীমা</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        এই সময়ের মধ্যে কোনো ক্যাম্পেইন মেসেজ পাঠানো হবে না (Asia/Dhaka সময় অনুযায়ী)।
      </p>
      {error && <div className="error">{error}</div>}
      {saved && <p style={{ color: "#166534", fontSize: 13 }}>সেভ হয়েছে</p>}

      <form action={handleSubmit}>
        <label htmlFor="quietStart">বন্ধ শুরু হবে</label>
        <select id="quietStart" name="quietStart" defaultValue={startHour} style={selectStyle}>
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </select>

        <label htmlFor="quietEnd">আবার শুরু হবে</label>
        <select id="quietEnd" name="quietEnd" defaultValue={endHour} style={selectStyle}>
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </button>
      </form>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
  marginBottom: 16,
};
