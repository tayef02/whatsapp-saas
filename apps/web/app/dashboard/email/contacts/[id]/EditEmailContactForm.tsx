"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import { updateEmailContact, deleteEmailContact } from "../actions";

interface Props {
  id: string;
  email: string;
  name: string;
  tags: string;
  customFields: Record<string, string>;
  consentSource: string;
  consentImportId: string | null;
}

export default function EditEmailContactForm(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await updateEmailContact(props.id, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/email/contacts");
  }

  async function handleDelete() {
    if (!confirm("এই কন্টাক্ট ডিলিট করবেন?")) return;
    setDeleting(true);
    const result = await deleteEmailContact(props.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/email/contacts");
  }

  const customEntries = Object.entries(props.customFields);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-1 text-base font-semibold text-text">{props.email}</h1>
        <p className="mb-4 text-xs text-text-muted">
          সম্মতির উৎস:{" "}
          {props.consentSource === "import_confirmed" && props.consentImportId ? (
            <Link href={`/dashboard/email/contacts/import/${props.consentImportId}`} className="text-primary hover:underline">
              ইম্পোর্টে নিশ্চিত (ইম্পোর্টের রেকর্ড দেখুন)
            </Link>
          ) : props.consentSource === "import_confirmed" ? (
            "ইম্পোর্টে নিশ্চিত"
          ) : (
            "ম্যানুয়ালি যোগ করার সময় নিশ্চিত"
          )}
        </p>
        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input name="name" type="text" label="নাম" defaultValue={props.name} />
          <Input name="tags" type="text" label="ট্যাগ" defaultValue={props.tags} placeholder="কমা দিয়ে আলাদা করুন" />

          {customEntries.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-text">ফাইলের অন্যান্য তথ্য (টেমপ্লেটে {"{{কলামের নাম}}"} দিয়ে ব্যবহার করা যাবে)</p>
              <dl className="rounded-lg border border-border bg-app-bg p-3 text-sm">
                {customEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 py-0.5">
                    <dt className="text-text-muted">{key}</dt>
                    <dd className="text-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <Button type="submit" loading={loading}>
            {loading ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </form>

        <Button variant="danger" onClick={handleDelete} loading={deleting} className="mt-4 w-full">
          ডিলিট করুন
        </Button>
      </Card>
    </div>
  );
}
