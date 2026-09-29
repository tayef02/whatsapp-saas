"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { formatWhatsAppPreviewHtml } from "@whatsapp-saas/core/templates/format-preview";
import { Card, Input, Select, Button, EmptyState } from "@/components/ui";
import { createCampaign, getAudienceCount } from "./actions";

type SampleContact = { name: string | null; phone: string; custom_fields: Record<string, string> };

interface Props {
  templates: { id: string; name: string; content: string }[];
  numbers: { id: string; display_name: string | null; status: string; min_delay_seconds: number; max_delay_seconds: number }[];
  sampleContact: SampleContact;
}

export default function NewCampaignForm({ templates, numbers, sampleContact }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [numberId, setNumberId] = useState("");
  const [audienceTag, setAudienceTag] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    const rendered = renderMessage(selectedTemplate.content, sampleContact);
    return formatWhatsAppPreviewHtml(rendered);
  }, [selectedTemplate, sampleContact]);

  function handleNumberChange(id: string) {
    setNumberId(id);
    const number = numbers.find((n) => n.id === id);
    if (number) {
      setMinDelay(number.min_delay_seconds);
      setMaxDelay(number.max_delay_seconds);
    }
  }

  // ট্যাগ লেখার সাথে সাথে (একটু দেরি করে) কতজন কন্টাক্ট পাবে দেখানো
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const count = await getAudienceCount(audienceTag.trim() || null);
      setAudienceCount(count);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [audienceTag]);

  async function handleSubmit(formData: FormData) {
    if (!scheduleLater) formData.delete("scheduledAt");

    setLoading(true);
    setError(null);
    const result = await createCampaign(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/campaigns/${result.id}`);
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="প্রথমে একটা টেমপ্লেট বানান"
        description="ক্যাম্পেইন পাঠাতে হলে আগে একটা মেসেজ টেমপ্লেট লাগবে।"
      />
    );
  }
  if (numbers.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title="অনলাইন কোনো WhatsApp নাম্বার নেই"
        description="আগে একটা নাম্বার কানেক্ট করুন, তারপর ক্যাম্পেইন পাঠানো যাবে।"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <Card className="flex-1">
        <h1 className="mb-4 text-base font-semibold text-text">নতুন ক্যাম্পেইন</h1>
        {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input id="name" name="name" type="text" required label="ক্যাম্পেইনের নাম" placeholder="যেমন: ঈদ অফার সেপ্টেম্বর" />

          <Select id="templateId" name="templateId" required label="টেমপ্লেট" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">বাছাই করুন</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

          <Select id="numberId" name="numberId" required label="নাম্বার" value={numberId} onChange={(e) => handleNumberChange(e.target.value)}>
            <option value="">বাছাই করুন</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.display_name ?? n.id}
              </option>
            ))}
          </Select>

          {numberId && (
            <div className="flex gap-3">
              <Input id="minDelay" name="minDelay" type="number" min={1} label="ন্যূনতম ডিলে (সেকেন্ড)" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
              <Input id="maxDelay" name="maxDelay" type="number" min={1} label="সর্বোচ্চ ডিলে (সেকেন্ড)" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
            </div>
          )}
          {numberId && (
            <p className="-mt-2 text-xs text-text-muted">এই ডিলে এই নাম্বারের সব ক্যাম্পেইনে প্রযোজ্য হবে (নাম্বার-ভিত্তিক, শুধু এই ক্যাম্পেইনের জন্য না)</p>
          )}

          <Input
            id="audienceTag"
            name="audienceTag"
            type="text"
            label="অডিয়েন্স"
            value={audienceTag}
            onChange={(e) => setAudienceTag(e.target.value)}
            placeholder="ফাঁকা রাখলে সব কন্টাক্ট, নাহলে ট্যাগের নাম দিন"
            helperText={audienceCount !== null ? `${audienceCount} জন কন্টাক্ট পাবে (opt-out বাদে)` : undefined}
          />

          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={scheduleLater} onChange={(e) => setScheduleLater(e.target.checked)} className="h-4 w-4" />
            পরে পাঠান (শিডিউল)
          </label>

          {scheduleLater && <Input id="scheduledAt" name="scheduledAt" type="datetime-local" label="কখন পাঠাবে" />}

          <Button type="submit" loading={loading}>
            {loading ? "তৈরি হচ্ছে..." : scheduleLater ? "শিডিউল করুন" : "এখনই পাঠান"}
          </Button>
        </form>
      </Card>

      <Card className="flex-1 self-start">
        <p className="mb-3 text-sm font-semibold text-text">প্রিভিউ</p>
        <div
          className="min-h-[120px] rounded-lg bg-[#dcf8c6] p-4 text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: previewHtml || "<span style='color:#888'>টেমপ্লেট বাছাই করলে প্রিভিউ দেখাবে</span>",
          }}
        />
        <p className="mt-3 text-xs text-text-muted">
          নমুনা কন্টাক্ট: {sampleContact.name ?? "(নাম নেই)"} · {sampleContact.phone}
        </p>
      </Card>
    </div>
  );
}
