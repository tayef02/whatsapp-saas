import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import { pauseCampaignsForNumber } from "../lib/campaign-safety";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { getSignedTemplateMediaUrl } from "@whatsapp-saas/core/templates/media";
import { MAX_SEND_RETRIES } from "@whatsapp-saas/core/campaigns/constants";

// একটা মেসেজ পাঠানোর পুরো ফ্লো: atomic claim (ডুপ্লিকেট আটকায়) → সব রিভেরিফাই
// (ক্যাম্পেইন/নাম্বার/কন্টাক্ট এখনো ঠিক আছে কিনা) → spintax+variable render *এখনই*
// (ক্যাম্পেইন বানানোর সময় না, তাহলে সবাই একই ভ্যারিয়েশন পেতো) → পাঠানো → স্ট্যাটাস আপডেট
export async function processSendCampaignMessage(data: { messageId: string }) {
  const supabase = getSupabase();
  const { messageId } = data;

  // atomic claim — এই UPDATE শুধু status এখনো 'scheduled' থাকলেই ম্যাচ করবে, তাই
  // একই মেসেজ দুই worker/দুইবার retry তে একসাথে ধরতে পারবে না
  const { data: claimed, error: claimError } = await supabase
    .from("messages")
    .update({ status: "sending", claimed_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("status", "scheduled")
    .select("id, campaign_id, contact_id, whatsapp_number_id, phone, retry_count")
    .maybeSingle();

  if (claimError || !claimed) {
    // অন্য worker আগেই নিয়ে নিয়েছে, অথবা এই মেসেজ ইতিমধ্যে cancel হয়ে গেছে
    return;
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, template_id, workspace_id")
    .eq("id", claimed.campaign_id)
    .maybeSingle();

  if (!campaign || campaign.status !== "sending") {
    // pause/cancel হয়ে গেছে — 'scheduled' এ ফিরিয়ে দেওয়া (resume হলে আবার তোলা হবে)
    await supabase.from("messages").update({ status: "scheduled", claimed_at: null }).eq("id", messageId);
    return;
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone, custom_fields, opted_out")
    .eq("id", claimed.contact_id)
    .maybeSingle();

  if (!contact || contact.opted_out) {
    await supabase.rpc("apply_message_status", {
      p_message_id: messageId,
      p_new_status: "failed",
      p_failed_reason: "contact opted out",
    });
    return;
  }

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("status, instance_name")
    .eq("id", claimed.whatsapp_number_id)
    .maybeSingle();

  if (!number || number.status !== "online") {
    // ব্যান/ডিসকানেক্ট — এখানে retry করে লাভ নেই, বাকি সবই ফেল করবে
    await supabase.rpc("apply_message_status", {
      p_message_id: messageId,
      p_new_status: "failed",
      p_failed_reason: "number offline",
    });
    await pauseCampaignsForNumber(claimed.whatsapp_number_id, campaign.workspace_id, "number_disconnected");
    return;
  }

  const { data: template } = await supabase
    .from("templates")
    .select("content, media_url, media_type")
    .eq("id", campaign.template_id)
    .maybeSingle();

  if (!template) {
    await supabase.rpc("apply_message_status", {
      p_message_id: messageId,
      p_new_status: "failed",
      p_failed_reason: "template not found",
    });
    return;
  }

  const finalText = renderMessage(template.content, contact);

  const providerInfo = await getProviderForNumber(claimed.whatsapp_number_id);
  if (!providerInfo) {
    await supabase.rpc("apply_message_status", {
      p_message_id: messageId,
      p_new_status: "failed",
      p_failed_reason: "evolution provider not found",
    });
    return;
  }

  try {
    let result: { messageId: string };

    if (template.media_url) {
      const { url: signedUrl, error: signedUrlError } = await getSignedTemplateMediaUrl(supabase, template.media_url);
      if (!signedUrl) throw new Error(`মিডিয়ার signed URL বানানো যায়নি: ${signedUrlError}`);

      result = await providerInfo.provider.sendMedia(
        providerInfo.instanceName,
        claimed.phone,
        signedUrl,
        template.media_type as "image" | "document",
        template.media_type === "image" ? "image/jpeg" : "application/pdf",
        finalText
      );
    } else {
      result = await providerInfo.provider.sendMessage(providerInfo.instanceName, claimed.phone, finalText);
    }

    await supabase.from("messages").update({ rendered_content: finalText }).eq("id", messageId);
    await supabase.rpc("apply_message_status", {
      p_message_id: messageId,
      p_new_status: "sent",
      p_provider_message_id: result.messageId,
    });
  } catch (err) {
    const retryCount = (claimed.retry_count ?? 0) + 1;
    const reason = err instanceof Error ? err.message : "অজানা এরর";
    const cause = err instanceof Error ? (err.cause as { code?: string; name?: string; message?: string } | undefined) : undefined;

    console.error(
      `[send-campaign-message] message=${messageId} retry=${retryCount}/${MAX_SEND_RETRIES} ব্যর্থ: ${reason}` +
        (cause ? ` | cause: ${cause.code ?? cause.name ?? "?"} ${cause.message ?? ""}` : "")
    );

    if (retryCount > MAX_SEND_RETRIES) {
      await supabase.rpc("apply_message_status", {
        p_message_id: messageId,
        p_new_status: "failed",
        p_failed_reason: reason,
      });
      return;
    }

    // সাময়িক এরর ধরে নিয়ে 'scheduled' এ ফিরিয়ে দেওয়া হলো, BullMQ নিজের backoff অনুযায়ী আবার চেষ্টা করবে
    await supabase
      .from("messages")
      .update({ status: "scheduled", retry_count: retryCount, claimed_at: null })
      .eq("id", messageId);

    throw err;
  }
}
