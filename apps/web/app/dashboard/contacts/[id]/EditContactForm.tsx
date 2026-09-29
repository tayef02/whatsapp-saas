"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
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
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
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
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-4 text-base font-semibold text-text">{contact.phone}</h1>

        {optedOut && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg bg-danger-light p-3">
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle className="h-4 w-4" /> এই কন্টাক্ট opt-out করেছে, ক্যাম্পেইন মেসেজ যাবে না
            </p>
            <Button variant="secondary" onClick={handleReactivate} disabled={loading} className="self-start">
              আবার চালু করুন
            </Button>
          </div>
        )}

        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input id="name" name="name" type="text" label="নাম" defaultValue={contact.name ?? ""} />
          <Input id="tags" name="tags" type="text" label="ট্যাগ (কমা দিয়ে আলাদা করুন)" defaultValue={contact.tags.join(", ")} />

          <CustomFieldsEditor initial={contact.custom_fields ?? {}} />

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </form>

        <Button variant="danger" onClick={handleDelete} loading={deleting} className="mt-3 w-full">
          ডিলিট করুন
        </Button>
      </Card>
    </div>
  );
}
