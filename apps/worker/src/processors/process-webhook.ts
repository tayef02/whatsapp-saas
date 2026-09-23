import { getSupabase } from "../lib/supabase";
import { pauseCampaignsForNumber } from "../lib/campaign-safety";
import { isStopKeyword } from "@whatsapp-saas/core/campaigns/stop-keywords";

type EvolutionWebhookBody = {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
};

function normalizeEvent(event: string | undefined): string {
  return (event ?? "").toLowerCase().replace(/_/g, ".");
}

function phoneFromJid(jid: string | undefined): string | undefined {
  return jid ? jid.replace(/@.*/, "") : undefined;
}

export async function processWebhookEvent(body: EvolutionWebhookBody) {
  const event = normalizeEvent(body.event);
  const instanceName = body.instance;
  const data = body.data ?? {};

  if (!instanceName) {
    console.warn("[webhook] instance নাম ছাড়া ইভেন্ট এসেছে, স্কিপ করা হলো", body);
    return;
  }

  if (event === "qrcode.updated") {
    await handleQrCodeUpdated(instanceName, data);
    return;
  }

  if (event === "connection.update") {
    await handleConnectionUpdate(instanceName, data);
    return;
  }

  if (event === "messages.update") {
    await handleMessageStatusUpdate(data);
    return;
  }

  if (event === "messages.upsert") {
    await handleIncomingMessage(instanceName, data);
    return;
  }

  // অন্য ইভেন্ট এখনো হ্যান্ডল করা হচ্ছে না
}

async function handleQrCodeUpdated(instanceName: string, data: Record<string, unknown>) {
  const qrCodeBase64 =
    (data.qrcode as { base64?: string } | undefined)?.base64 ?? (data.base64 as string | undefined) ?? null;

  await getSupabase()
    .from("whatsapp_numbers")
    .update({ qr_code: qrCodeBase64, status: "connecting" })
    .eq("instance_name", instanceName);
}

async function handleConnectionUpdate(instanceName: string, data: Record<string, unknown>) {
  const supabase = getSupabase();
  const state = data.state as string | undefined;
  const status = state === "open" ? "online" : state === "connecting" ? "connecting" : "offline";

  const ownerJid = (data.wuid as string | undefined) ?? (data.ownerJid as string | undefined);
  const phoneNumber = phoneFromJid(ownerJid);

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .update({
      status,
      qr_code: status === "online" ? null : undefined,
      connected_at: status === "online" ? new Date().toISOString() : undefined,
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
    })
    .eq("instance_name", instanceName)
    .select("id, workspace_id")
    .maybeSingle();

  // সেফটি নিয়ম: নাম্বার ডিসকানেক্ট/ব্যান হলে সাথে সাথে চলমান ক্যাম্পেইন পজ + নোটিফিকেশন
  if (number && status !== "online" && status !== "connecting") {
    await pauseCampaignsForNumber(number.id, number.workspace_id, "number_disconnected");
  }
}

// ডেলিভারি/read স্ট্যাটাস আপডেট (আমাদের পাঠানো মেসেজের ack)
async function handleMessageStatusUpdate(data: Record<string, unknown>) {
  const rawStatus = String(data.status ?? "").toUpperCase();
  const providerMessageId = (data.keyId as string | undefined) ?? (data.key as { id?: string } | undefined)?.id;

  if (!providerMessageId) return;

  let newStatus: "delivered" | "read" | null = null;
  if (rawStatus === "DELIVERY_ACK") newStatus = "delivered";
  else if (rawStatus === "READ") newStatus = "read";
  else return; // SERVER_ACK ইত্যাদি — আমাদের ফানেলে নতুন কিছু যোগ করে না

  const supabase = getSupabase();
  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!message) return;

  await supabase.rpc("apply_message_status", { p_message_id: message.id, p_new_status: newStatus });
}

// ইনকামিং মেসেজ — শুধু STOP/বন্ধ ডিটেকশনের জন্য (মডিউল ৫ এর সেফটি নিয়ম)
async function handleIncomingMessage(instanceName: string, data: Record<string, unknown>) {
  const key = data.key as { remoteJid?: string; fromMe?: boolean } | undefined;
  if (!key || key.fromMe) return; // নিজের পাঠানো মেসেজের echo, স্কিপ

  const text =
    (data.message as { conversation?: string } | undefined)?.conversation ??
    (data.message as { extendedTextMessage?: { text?: string } } | undefined)?.extendedTextMessage?.text ??
    "";

  if (!isStopKeyword(text)) return;

  const phone = phoneFromJid(key.remoteJid);
  if (!phone) return;

  const supabase = getSupabase();
  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("workspace_id")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (!number) return;

  await supabase
    .from("contacts")
    .update({ opted_out: true })
    .eq("workspace_id", number.workspace_id)
    .eq("phone", phone);
}
