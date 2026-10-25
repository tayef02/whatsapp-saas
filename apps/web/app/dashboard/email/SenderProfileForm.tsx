"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Badge, Button, Card, Input, Textarea, useToast } from "@/components/ui";
import { resendReplyToConfirmation, saveSenderProfile } from "./actions";

interface Props {
  fromNameValue: string; // ফর্মে যা দেখাবে (অপেক্ষমান অনুরোধ থাকলে সেটা, নাহলে সক্রিয় নাম)
  fromNameStatus: string; // none | approved | pending_approval | rejected
  blockReason: string | null;
  replyTo: string;
  replyToVerified: boolean;
  businessName: string;
  postalAddress: string;
  canEdit: boolean;
}

// workspace এর ইমেইল প্রেরকের তথ্য: From নাম, Reply-To, ব্যবসার নাম ও ঠিকানা (ফুটারে বাধ্যতামূলক)
export default function SenderProfileForm(props: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await saveSenderProfile(formData);
    setLoading(false);

    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", result.notice ?? "সেভ হয়েছে");
  }

  async function handleResend() {
    setResending(true);
    const result = await resendReplyToConfirmation();
    setResending(false);

    if (result.error) showToast("error", result.error);
    else showToast("success", result.notice ?? "পাঠানো হচ্ছে");
  }

  const blockedTerm = props.blockReason?.startsWith("blocked_term:") ? props.blockReason.slice("blocked_term:".length) : null;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">প্রেরকের তথ্য</p>
      </div>

      <form action={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <div>
          <Input
            name="fromName"
            label="From নাম (প্রাপক যে নামে দেখবে)"
            defaultValue={props.fromNameValue}
            maxLength={60}
            required
            disabled={!props.canEdit}
            helperText="যেমন: আপনার দোকানের নাম। ব্যাংক, মোবাইল ব্যাংকিং বা পরিচিত ব্র্যান্ডের নাম থাকলে অনুমোদন লাগে।"
          />
          {props.fromNameStatus === "pending_approval" && (
            <p className="mt-1.5 text-xs text-warning">
              ⏳ অনুমোদনের অপেক্ষায়{blockedTerm ? ` ("${blockedTerm}" শব্দ সংরক্ষিত)` : ""} — অনুমোদিত না হওয়া পর্যন্ত আগের সক্রিয় নাম (থাকলে) ব্যবহার হবে।
            </p>
          )}
          {props.fromNameStatus === "rejected" && <p className="mt-1.5 text-xs text-danger">❌ আগের অনুরোধটি বাতিল হয়েছে — অন্য একটা নাম দিন।</p>}
        </div>

        <div>
          <Input
            name="replyTo"
            type="email"
            label="Reply-To ইমেইল (গ্রাহক উত্তর দিলে এখানে আসবে)"
            defaultValue={props.replyTo}
            required
            disabled={!props.canEdit}
          />
          {props.replyTo && (
            <div className="mt-1.5 flex items-center gap-2">
              {props.replyToVerified ? (
                <Badge variant="success">যাচাই হয়েছে</Badge>
              ) : (
                <>
                  <Badge variant="warning">যাচাই বাকি</Badge>
                  {props.canEdit && (
                    <Button type="button" variant="ghost" loading={resending} onClick={handleResend} className="!px-2 !py-1 text-xs">
                      কনফার্মেশন মেইল আবার পাঠান
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Input
          name="businessName"
          label="ব্যবসার নাম (প্রতিটা ইমেইলের ফুটারে)"
          defaultValue={props.businessName}
          maxLength={120}
          required
          disabled={!props.canEdit}
        />
        <Textarea
          name="postalAddress"
          label="ব্যবসার ঠিকানা (প্রতিটা ইমেইলের ফুটারে)"
          defaultValue={props.postalAddress}
          maxLength={300}
          rows={2}
          required
          disabled={!props.canEdit}
        />

        {props.canEdit ? (
          <Button type="submit" loading={loading} className="self-start">
            সেভ করুন
          </Button>
        ) : (
          <p className="text-xs text-text-muted">শুধু মালিক বা অ্যাডমিন এই তথ্য বদলাতে পারবেন।</p>
        )}
      </form>
    </Card>
  );
}
