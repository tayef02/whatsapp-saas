import { getSupabase } from "../lib/supabase";
import { pauseCampaignsForNumber } from "../lib/campaign-safety";
import { isStopKeyword, isStartKeyword } from "@whatsapp-saas/core/campaigns/stop-keywords";

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

  console.log(`[webhook worker] processing event=${event} (raw=${body.event}) instance=${instanceName}`);

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
  console.log(`[webhook worker] event=${event} এর জন্য কোনো হ্যান্ডলার নেই, স্কিপ করা হলো`);
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

// Baileys এর numeric ack কোড (Evolution কখনো কখনো স্ট্রিং এর বদলে এই নাম্বার পাঠাতে পারে):
// 0 ERROR, 1 PENDING, 2 SERVER_ACK, 3 DELIVERY_ACK, 4 READ, 5 PLAYED
const ACK_CODE_TO_STATUS: Record<string, string> = {
  "0": "ERROR",
  "1": "PENDING",
  "2": "SERVER_ACK",
  "3": "DELIVERY_ACK",
  "4": "READ",
  "5": "PLAYED",
};

// একটা single update অবজেক্ট প্রসেস করে — Evolution সাধারণত data কে single object হিসেবে
// পাঠায় (প্রতিটা মেসেজ আপডেটের জন্য আলাদা webhook কল), কিন্তু কখনো array এলেও যেন স্কিপ না হয়ে যায়
async function handleOneMessageStatusUpdate(item: Record<string, unknown>) {
  const rawStatusValue = item.status;
  const rawStatus =
    typeof rawStatusValue === "number" || /^\d+$/.test(String(rawStatusValue ?? ""))
      ? (ACK_CODE_TO_STATUS[String(rawStatusValue)] ?? "")
      : String(rawStatusValue ?? "").toUpperCase();
  const providerMessageId =
    (item.keyId as string | undefined) ?? (item.key as { id?: string } | undefined)?.id ?? (item.messageId as string | undefined);

  if (!providerMessageId) {
    console.log("[webhook worker] messages.update এ keyId পাওয়া যায়নি, স্কিপ", item);
    return;
  }

  let newStatus: "delivered" | "read" | null = null;
  if (rawStatus === "DELIVERY_ACK") newStatus = "delivered";
  else if (rawStatus === "READ") newStatus = "read";
  else {
    console.log(`[webhook worker] messages.update status=${rawStatus} (keyId=${providerMessageId}) — delivered/read না, স্কিপ`);
    return;
  }

  const supabase = getSupabase();
  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!message) {
    console.log(`[webhook worker] provider_message_id=${providerMessageId} এর সাথে মিলে এমন কোনো message পাওয়া যায়নি`);
    return;
  }

  const { data: applied } = await supabase.rpc("apply_message_status", {
    p_message_id: message.id,
    p_new_status: newStatus,
  });
  console.log(`[webhook worker] message ${message.id} → ${newStatus}, applied=${applied}`);
}

// ডেলিভারি/read স্ট্যাটাস আপডেট (আমাদের পাঠানো মেসেজের ack)
async function handleMessageStatusUpdate(data: Record<string, unknown> | Record<string, unknown>[]) {
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    await handleOneMessageStatusUpdate(item);
  }
}

// ইনকামিং মেসেজ — STOP/বন্ধ (opt-out) আর START/চালু (আবার opt-in) ডিটেকশনের জন্য
async function handleIncomingMessage(instanceName: string, data: Record<string, unknown>) {
  const key = data.key as { remoteJid?: string; fromMe?: boolean } | undefined;
  if (!key || key.fromMe) return; // নিজের পাঠানো মেসেজের echo, স্কিপ

  const text =
    (data.message as { conversation?: string } | undefined)?.conversation ??
    (data.message as { extendedTextMessage?: { text?: string } } | undefined)?.extendedTextMessage?.text ??
    "";

  const isStop = isStopKeyword(text);
  const isStart = isStartKeyword(text);
  if (!isStop && !isStart) return;

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
    .update({ opted_out: isStop })
    .eq("workspace_id", number.workspace_id)
    .eq("phone", phone);
}
