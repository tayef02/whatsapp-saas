"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Card, Input, Button } from "@/components/ui";
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
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-text">নতুন কন্টাক্ট</h1>
        </div>

        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input id="phone" name="phone" type="text" required label="নাম্বার" placeholder="01712345678" />
          <Input id="name" name="name" type="text" label="নাম (ঐচ্ছিক)" />
          <Input id="tags" name="tags" type="text" label="ট্যাগ (কমা দিয়ে আলাদা করুন)" placeholder="যেমন: ভিআইপি, ঢাকা" />

          <CustomFieldsEditor initial={{}} />

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "যোগ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
