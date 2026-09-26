import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { pauseCampaignsForNumber } from "../lib/campaign-safety";
import { isStopKeyword, isStartKeyword } from "@whatsapp-saas/core/campaigns/stop-keywords";
import { renderMessage } from "@whatsapp-saas/core/templates/render";
import { AUTOREPLY_QUEUE_NAME } from "../queues/autoreply-queue";
import type { AutoReplyJobData } from "@whatsapp-saas/core/chatbot/types";
import { createNotification } from "../lib/notify";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
let autoReplyQueue: Queue | null = null;
function getAutoReplyQueue() {
  if (!autoReplyQueue) autoReplyQueue = new Queue(AUTOREPLY_QUEUE_NAME, { connection });
  return autoReplyQueue;
}

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

// ইনকামিং মেসেজ — STOP/বন্ধ (opt-out), START/চালু (আবার opt-in), আর keyword auto-reply
async function handleIncomingMessage(instanceName: string, data: Record<string, unknown>) {
  const key = data.key as { remoteJid?: string; fromMe?: boolean } | undefined;
  if (!key || key.fromMe) return; // নিজের পাঠানো মেসেজের echo, স্কিপ
  if (key.remoteJid?.endsWith("@g.us")) return; // গ্রুপ মেসেজ — auto-reply শুধু personal chat এর জন্য

  const text =
    (data.message as { conversation?: string } | undefined)?.conversation ??
    (data.message as { extendedTextMessage?: { text?: string } } | undefined)?.extendedTextMessage?.text ??
    "";
  if (!text.trim()) return;

  const phone = phoneFromJid(key.remoteJid);
  if (!phone) return;

  const supabase = getSupabase();
  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, workspace_id")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (!number) return;

  const isStop = isStopKeyword(text);
  const isStart = isStartKeyword(text);

  if (isStop || isStart) {
    await supabase.from("contacts").update({ opted_out: isStop }).eq("workspace_id", number.workspace_id).eq("phone", phone);
    return; // STOP/START নিজেই একটা কমান্ড — auto-reply এর দরকার নেই
  }

  await handleAutoReply(supabase, number, phone, text);
}

// contact না থাকলে অটো-তৈরি করে, conversation খুঁজে/বানায়, ইতিহাসে লেখে, rule ম্যাচ করে reply পাঠানোর job বসায়
async function handleAutoReply(
  supabase: ReturnType<typeof getSupabase>,
  number: { id: string; workspace_id: string },
  phone: string,
  text: string
) {
  const { data: config } = await supabase
    .from("chatbot_configs")
    .select("id, is_active, fallback_message")
    .eq("whatsapp_number_id", number.id)
    .maybeSingle();

  if (!config || !config.is_active) {
    console.log(`[autoreply] নাম্বার ${number.id} এ chatbot config নেই/বন্ধ আছে, স্কিপ`);
    return;
  }

  let { data: contact } = await supabase
    .from("contacts")
    .select("id, name, custom_fields")
    .eq("workspace_id", number.workspace_id)
    .eq("phone", phone)
    .maybeSingle();

  if (!contact) {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({ workspace_id: number.workspace_id, phone, source: "inbound" })
      .select("id, name, custom_fields")
      .maybeSingle();
    contact = newContact;
  }
  if (!contact) return;

  const { data: conversation } = await supabase
    .from("conversations")
    .upsert(
      { workspace_id: number.workspace_id, whatsapp_number_id: number.id, contact_id: contact.id, last_message_at: new Date().toISOString() },
      { onConflict: "whatsapp_number_id,contact_id" }
    )
    .select("id, status")
    .maybeSingle();

  if (!conversation) {
    console.log(`[autoreply] conversation upsert ব্যর্থ (number=${number.id}, contact=${contact.id})`);
    return;
  }

  await supabase
    .from("conversation_messages")
    .insert({ conversation_id: conversation.id, direction: "inbound", sender_type: "customer", content: text });

  console.log(`[autoreply] conversation=${conversation.id} status=${conversation.status}, text="${text}"`);

  // এজেন্ট হ্যান্ডল করছে এমন কথোপকথনে bot চুপ থাকবে — এজেন্ট Inbox থেকে "আবার চালু করুন"
  // না চাপা পর্যন্ত পরের সব মেসেজেও চুপ থাকবে (ইচ্ছাকৃতভাবে sticky, ইনবাউন্ড মেসেজ তবুও সেভ হয়)
  if (conversation.status === "handed_off") {
    console.log(`[autoreply] conversation=${conversation.id} handed_off — bot চুপ থাকছে`);
    return;
  }

  // resolved থেকে আবার active — নতুন মেসেজ এসেছে মানে কথোপকথন আবার চলছে
  if (conversation.status === "resolved") {
    await supabase.from("conversations").update({ status: "active" }).eq("id", conversation.id);
  }

  const { data: rules } = await supabase
    .from("chatbot_rules")
    .select("keyword, match_type, reply_text")
    .eq("chatbot_config_id", config.id)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const normalizedText = text.trim().toLowerCase();
  const matchedRule = (rules ?? []).find((r) => {
    const keyword = r.keyword.trim().toLowerCase();
    return r.match_type === "exact" ? normalizedText === keyword : normalizedText.includes(keyword);
  });

  console.log(`[autoreply] conversation=${conversation.id} ${rules?.length ?? 0}টা rule চেক হলো, matched=${matchedRule?.keyword ?? "কোনোটা না"}`);

  const renderContact = { name: contact.name, phone, custom_fields: contact.custom_fields };

  if (matchedRule) {
    const jobData: AutoReplyJobData = {
      conversationId: conversation.id,
      workspaceId: number.workspace_id,
      whatsappNumberId: number.id,
      phone,
      replyText: renderMessage(matchedRule.reply_text, renderContact),
      markHandedOff: false,
    };
    await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[autoreply] rule "${matchedRule.keyword}" ম্যাচ হয়েছে, reply job queue তে বসলো`);
    return;
  }

  // কোনো rule মেলেনি — এজেন্টের কাছে হ্যান্ডঅফ, পারলে একটা fallback মেসেজও পাঠানো হবে
  if (config.fallback_message) {
    const jobData: AutoReplyJobData = {
      conversationId: conversation.id,
      workspaceId: number.workspace_id,
      whatsappNumberId: number.id,
      phone,
      replyText: renderMessage(config.fallback_message, renderContact),
      markHandedOff: true,
    };
    await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[autoreply] কোনো rule মেলেনি, fallback job queue তে বসলো, handed_off হবে`);
  } else {
    console.log(`[autoreply] কোনো rule/fallback নেই, সরাসরি handed_off করা হলো`);
    await supabase.from("conversations").update({ status: "handed_off" }).eq("id", conversation.id);
    await createNotification(
      number.workspace_id,
      "conversation_handed_off",
      "একটা কথোপকথনে এজেন্টের সাহায্য দরকার",
      "কাস্টমারের মেসেজের সাথে কোনো auto-reply rule মেলেনি — Inbox এ গিয়ে দেখুন।"
    );
  }
}
