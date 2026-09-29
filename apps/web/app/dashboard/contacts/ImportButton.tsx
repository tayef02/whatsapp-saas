"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, SkipForward, AlertTriangle } from "lucide-react";
import { Modal, Button, Input } from "@/components/ui";
import { startImport } from "./import/actions";

export default function ImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; duplicate: number; invalid: number } | null>(null);

  function handleClose() {
    setOpen(false);
    setError(null);
    setResult(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const res = await startImport(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.done) {
      setResult({ added: res.added, duplicate: res.duplicate, invalid: res.invalid });
      router.refresh();
      return;
    }
    setOpen(false);
    router.push(`/dashboard/contacts/import/${res.importJobId}`);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> ইমপোর্ট
      </Button>

      <Modal open={open} onClose={handleClose} title="কন্টাক্ট ইমপোর্ট করুন">
        <p className="mb-4 text-xs text-text-muted">
          CSV বা Excel ফাইল দিন। প্রথম সারি হেডার (phone/mobile/নাম্বার, name/নাম) হতে হবে। নাম্বার যেকোনো ফরম্যাটে
          (01XXX, +8801XXX ইত্যাদি) দিলে চলবে।
        </p>

        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        {result ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-app-bg p-3 text-sm">
              <span className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> {result.added} জন যোগ হয়েছে
              </span>
              <span className="flex items-center gap-2 text-text-muted">
                <SkipForward className="h-4 w-4" /> {result.duplicate} জন ডুপ্লিকেট (বাদ গেছে)
              </span>
              <span className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" /> {result.invalid} টা নাম্বার ইনভ্যালিড (বাদ গেছে)
              </span>
            </div>
            <Button onClick={handleClose} className="w-full">
              ঠিক আছে
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-text">ফাইল</span>
              <input
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-primary"
              />
            </label>

            <Input name="tag" label="ট্যাগ (ঐচ্ছিক)" placeholder="যেমন: ঈদ ক্যাম্পেইন ২০২৬" helperText="দিলে ইমপোর্ট হওয়া সবাইকে এই ট্যাগ লাগবে" />

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "প্রসেস হচ্ছে..." : "ইমপোর্ট শুরু করুন"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
