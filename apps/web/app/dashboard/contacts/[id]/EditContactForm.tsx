"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContact, deleteContact, reactivateContact } from "../actions";
import CustomFieldsEditor from "../CustomFieldsEditor";

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
  const [optedOut, setOptedOut] = useState(contact.opted_out);

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

  async function handleReactivate() {
    setLoading(true);
    await reactivateContact(contact.id);
    setLoading(false);
    setOptedOut(false);
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <h1>{contact.phone}</h1>
      {optedOut && (
        <div style={{ background: "#fee2e2", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>
            এই কন্টাক্ট opt-out করেছে, ক্যাম্পেইন মেসেজ যাবে না
          </p>
          <button type="button" onClick={handleReactivate} disabled={loading} style={{ fontSize: 13 }}>
            আবার চালু করুন
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      <form action={handleSubmit}>
        <label htmlFor="name">নাম</label>
        <input id="name" name="name" type="text" defaultValue={contact.name ?? ""} />

        <label htmlFor="tags">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
        <input id="tags" name="tags" type="text" defaultValue={contact.tags.join(", ")} />

        <CustomFieldsEditor initial={contact.custom_fields ?? {}} />

        <button type="submit" disabled={loading}>
          {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </button>
      </form>

      <button onClick={handleDelete} style={{ marginTop: 16, background: "white", color: "#dc2626", border: "1px solid #dc2626" }}>
        ডিলিট করুন
      </button>
    </div>
  );
}
