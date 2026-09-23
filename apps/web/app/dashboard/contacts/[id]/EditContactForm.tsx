"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContact, deleteContact } from "../actions";

type Contact = {
  id: string;
  phone: string;
  name: string | null;
  tags: string[];
  opted_out: boolean;
  custom_fields: Record<string, string>;
};

export default function EditContactForm({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await updateContact(contact.id, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/contacts");
  }

  async function handleDelete() {
    if (!confirm("এই কন্টাক্ট ডিলিট করবেন?")) return;
    await deleteContact(contact.id);
    router.push("/dashboard/contacts");
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>{contact.phone}</h1>
      {contact.opted_out && <p style={{ color: "#dc2626", fontSize: 13 }}>এই কন্টাক্ট opt-out করেছে, ক্যাম্পেইন মেসেজ যাবে না</p>}
      {error && <div className="error">{error}</div>}

      <form action={handleSubmit}>
        <label htmlFor="name">নাম</label>
        <input id="name" name="name" type="text" defaultValue={contact.name ?? ""} />

        <label htmlFor="tags">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
        <input id="tags" name="tags" type="text" defaultValue={contact.tags.join(", ")} />

        <button type="submit" disabled={loading}>
          {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </button>
      </form>

      {Object.keys(contact.custom_fields ?? {}).length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: "#666" }}>
          <strong>এক্সট্রা তথ্য (import থেকে):</strong>
          <ul>
            {Object.entries(contact.custom_fields).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={handleDelete} style={{ marginTop: 16, background: "white", color: "#dc2626", border: "1px solid #dc2626" }}>
        ডিলিট করুন
      </button>
    </div>
  );
}
