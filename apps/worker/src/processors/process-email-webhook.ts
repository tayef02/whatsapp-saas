import { getEmailProvider } from "@whatsapp-saas/core/providers/email";
import { getSupabase } from "../lib/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EmailWebhookJob {
  provider: string;
  providerEventId: string;
  payload: unknown;
}

// ফেজ ১: প্রোভাইডারের ইভেন্ট email_events এ সংরক্ষণ (dedupe + অডিট)। (provider, provider_event_id)
// unique — একই ইভেন্ট দুইবার এলে (provider retry / queue retry) দ্বিতীয়বার কিছু হয় না।
// ফেজ ৩ এ এখানে apply_email_event() যোগ হবে (recipient status, stats, bounce/complaint suppression)।
//
// লগ ও DB তে প্রাপকের ঠিকানা/সাবজেক্ট/বডি রাখা হয় না — normalizeEvents শুধু দরকারি অংশ বের করে।
export async function processEmailWebhookEvent(data: EmailWebhookJob): Promise<void> {
  const provider = getEmailProvider();
  const events = provider.normalizeEvents(data.payload, data.providerEventId);
  if (events.length === 0) {
    console.log("[email-webhook] অচেনা ইভেন্ট ফরম্যাট, বাদ দেওয়া হলো");
    return;
  }

  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  for (const event of events) {
    // আমরা নিজেরাই পাঠানোর সময় ws ট্যাগ বসাই; ফেরত এলে workspace চিনতে ব্যবহার হয়
    const tagged = event.tags.ws;
    const workspaceId = tagged && UUID_PATTERN.test(tagged) ? tagged : null;

    const row = {
      workspace_id: workspaceId,
      provider: provider.name,
      provider_event_id: event.providerEventId,
      provider_message_id: event.providerMessageId,
      event_type: event.eventType,
      bounce_type: event.bounceType,
      detail: event.detail,
      occurred_at: event.occurredAt ?? nowIso,
      processed_at: nowIso,
    };

    let { error } = await supabase.from("email_events").upsert(row, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });

    // workspace মুছে গেছে (FK violation) — ইভেন্ট হারাতে না দিয়ে workspace ছাড়া সংরক্ষণ
    if (error?.code === "23503" && workspaceId) {
      ({ error } = await supabase
        .from("email_events")
        .upsert({ ...row, workspace_id: null }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true }));
    }

    if (error) throw new Error(`email_events সংরক্ষণ ব্যর্থ: ${error.message}`);
  }
}
