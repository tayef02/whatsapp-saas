"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "../actions";
import CustomFieldsEditor from "../CustomFieldsEditor";

export default function NewContactPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createContact(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/contacts");
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>নতুন কন্টাক্ট</h1>
      {error && <div className="error">{error}</div>}
      <form action={handleSubmit}>
        <label htmlFor="phone">নাম্বার</label>
        <input id="phone" name="phone" type="text" required placeholder="01712345678" />

        <label htmlFor="name">নাম (ঐচ্ছিক)</label>
        <input id="name" name="name" type="text" />

        <label htmlFor="tags">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
        <input id="tags" name="tags" type="text" placeholder="যেমন: ভিআইপি, ঢাকা" />

        <CustomFieldsEditor initial={{}} />

        <button type="submit" disabled={loading}>
          {loading ? "যোগ হচ্ছে..." : "যোগ করুন"}
        </button>
      </form>
    </div>
  );
}
