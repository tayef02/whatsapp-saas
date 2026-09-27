import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { pauseCampaignsForNumber } from "../lib/campaign-safety";
import { isStopKeyword, isStartKeyword } from "@whatsapp-saas/core/campaigns/stop-keywords";
import { AUTOREPLY_QUEUE_NAME } from "../queues/autoreply-queue";
import type { AutoReplyJobData } from "@whatsapp-saas/core/chatbot/types";
import { createNotification } from "../lib/notify";
import { generateEmbedding, generateChatReply, type LlmProvider, type ChatTurn } from "@whatsapp-saas/core/chatbot/llm";
import {
  FULL_TEXT_MODE_MAX_WORDS,
  NO_ANSWER_MARKER,
  MAX_HISTORY_MESSAGES,
  ORDER_BLOCK_START,
  ORDER_BLOCK_END,
} from "@whatsapp-saas/core/chatbot/constants";
import { extractOrderBlock, type ParsedOrder } from "@whatsapp-saas/core/chatbot/order-block";
import type { GroupReplyJobData } from "@whatsapp-saas/core/groups/types";

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
    console.warn("[webhook] event has no instance name, skipping", body);
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

  // লাইভ VPS-এ যাচাই করা হয়েছে: এই ইভেন্টটা Evolution অন্যগুলোর (UPPER_SNAKE_CASE) মতো না
  // পাঠিয়ে সরাসরি "group-participants.update" (kebab-case + dot) হিসেবে পাঠায়, তাই
  // normalizeEvent এর underscore→dot রূপান্তরের পরও হাইফেনটা থেকে যায় — dot ভার্সনের বদলে
  // এই আসল ফরম্যাটটাই ম্যাচ করা হচ্ছে
  if (event === "group-participants.update") {
    await handleGroupParticipantsUpdate(instanceName, data);
    return;
  }

  // অন্য ইভেন্ট এখনো হ্যান্ডল করা হচ্ছে না
  console.log(`[webhook worker] no handler for event=${event}, skipping`);
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
    console.log("[webhook worker] messages.update has no keyId, skipping", item);
    return;
  }

  let newStatus: "delivered" | "read" | null = null;
  if (rawStatus === "DELIVERY_ACK") newStatus = "delivered";
  else if (rawStatus === "READ") newStatus = "read";
  else {
    console.log(`[webhook worker] messages.update status=${rawStatus} (keyId=${providerMessageId}) is not delivered/read, skipping`);
    return;
  }

  const supabase = getSupabase();
  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (message) {
    const { data: applied } = await supabase.rpc("apply_message_status", {
      p_message_id: message.id,
      p_new_status: newStatus,
    });
    console.log(`[webhook worker] message ${message.id} → ${newStatus}, applied=${applied}`);
    return;
  }

  // ১:১ ক্যাম্পেইন/চ্যাট মেসেজে না মিললে, বটের নিজের পাঠানো গ্রুপ রিপ্লাই (welcome/keyword/AI)
  // হতে পারে — group_messages এও চেক করা হয়
  const { data: groupMessage } = await supabase
    .from("group_messages")
    .update({ status: newStatus })
    .eq("provider_message_id", providerMessageId)
    .select("id")
    .maybeSingle();

  if (groupMessage) {
    console.log(`[group-messages] message ${groupMessage.id} → ${newStatus}`);
    return;
  }

  console.log(`[webhook worker] no message/group_message found matching provider_message_id=${providerMessageId}`);
}

// ডেলিভারি/read স্ট্যাটাস আপডেট (আমাদের পাঠানো মেসেজের ack)
async function handleMessageStatusUpdate(data: Record<string, unknown> | Record<string, unknown>[]) {
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    await handleOneMessageStatusUpdate(item);
  }
}

// ইনকামিং মেসেজ — STOP/বন্ধ (opt-out), START/চালু (আবার opt-in), আর AI auto-reply
async function handleIncomingMessage(instanceName: string, data: Record<string, unknown>) {
  const key = data.key as { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string } | undefined;
  if (!key || key.fromMe) return; // নিজের পাঠানো মেসেজের echo, স্কিপ

  if (key.remoteJid?.endsWith("@g.us")) {
    // গ্রুপ মেসেজ — ১:১ AI চ্যাটবট এখানে চলে না, শুধু কিওয়ার্ড অটো-রিপ্লাই (থাকলে) চেক হয়
    await handleGroupMessage(instanceName, data, key);
    return;
  }

  const text =
    (data.message as { conversation?: string } | undefined)?.conversation ??
    (data.message as { extendedTextMessage?: { text?: string } } | undefined)?.extendedTextMessage?.text ??
    "";
  if (!text.trim()) return;

  const phone = phoneFromJid(key.remoteJid);
  if (!phone) return;

  const providerMessageId = key.id;

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

  await handleAutoReply(supabase, number, phone, text, providerMessageId);
}

// নতুন মেম্বার গ্রুপে জয়েন করলে (Baileys এর action="add") ওয়েলকাম মেসেজ পাঠায়, যদি সেই
// গ্রুপে welcome_enabled চালু থাকে। {{group_name}}/{{invite_link}} প্লেসহোল্ডার সাপোর্ট করে —
// invite_link শুধু তখনই বসে যখন আগে থেকে ইনভাইট লিংক আনা হয়েছে (groups.invite_code সেট আছে)।
// remove/promote/demote অ্যাকশনে কিছু হয় না, শুধু "add"।
//
// লক্ষণীয়: এই ইভেন্ট (GROUP_PARTICIPANTS_UPDATE) নতুন createInstance কল-এ webhook ইভেন্ট
// লিস্টে যোগ করা হয়েছে, কিন্তু আগে থেকে কানেক্টেড নাম্বারে এটা পেতে হলে একবার webhook resync
// (setWebhook) করা লাগবে — Groups পেজ থেকে করা যায়
async function handleGroupParticipantsUpdate(instanceName: string, data: Record<string, unknown>) {
  const action = data.action as string | undefined;
  const groupJid = data.id as string | undefined;
  const participants = (data.participants as string[] | undefined) ?? [];

  if (action !== "add" || !groupJid || participants.length === 0) return;

  const supabase = getSupabase();
  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, workspace_id")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!number) return;

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code, welcome_enabled, welcome_message")
    .eq("whatsapp_number_id", number.id)
    .eq("group_jid", groupJid)
    .maybeSingle();

  if (!group || !group.welcome_enabled || !group.welcome_message) return;

  console.log(`[group-welcome] ${participants.length} new member(s) joined group=${groupJid}, sending welcome message`);

  const welcomeText = group.welcome_message
    .replace(/\{\{group_name\}\}/g, group.name || "")
    .replace(/\{\{invite_link\}\}/g, group.invite_code ? `https://chat.whatsapp.com/${group.invite_code}` : "");

  const jobData: GroupReplyJobData = {
    workspaceId: number.workspace_id,
    whatsappNumberId: number.id,
    groupId: group.id,
    groupJid,
    replyText: welcomeText,
  };
  await getAutoReplyQueue().add("group-reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
}

// গ্রুপ মেসেজে শুধু কিওয়ার্ড-বেসড অটো-রিপ্লাই চেক হয় (AI/RAG চলে না, সেটা শুধু ১:১ চ্যাটের জন্য)।
type GroupMessageContent = { text: string; mediaType: "image" | "document" | "video" | "audio" | "sticker" | null };

// Baileys/Evolution এর মেসেজ অবজেক্ট থেকে টেক্সট বা মিডিয়া (ক্যাপশনসহ) বের করে। মিডিয়া
// ফাইল আসলেই ডাউনলোড করে স্টোরেজে সেভ করা এখনো implement করা হয়নি (Evolution base64 কোন
// ফিল্ডে পাঠায় লাইভ payload না দেখে নিশ্চিত না) — তাই raw media অবজেক্ট একবার লগ করা হয়,
// যাতে পরের ধাপে সঠিক ফিল্ড ধরে media_url পপুলেট করা যায়
function extractGroupMessageContent(data: Record<string, unknown>): GroupMessageContent {
  const message = data.message as Record<string, any> | undefined;
  if (!message) return { text: "", mediaType: null };

  if (typeof message.conversation === "string") return { text: message.conversation, mediaType: null };
  if (typeof message.extendedTextMessage?.text === "string") return { text: message.extendedTextMessage.text, mediaType: null };

  const mediaFields: Array<[string, GroupMessageContent["mediaType"]]> = [
    ["imageMessage", "image"],
    ["documentMessage", "document"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["stickerMessage", "sticker"],
  ];
  for (const [key, type] of mediaFields) {
    const media = message[key];
    if (media) {
      console.log(`[group-messages] media message detected (type=${type}): ${JSON.stringify(media).slice(0, 300)}`);
      return { text: typeof media.caption === "string" ? media.caption : "", mediaType: type };
    }
  }
  return { text: "", mediaType: null };
}

const GROUP_MEDIA_LABEL_BN: Record<string, string> = {
  image: "[ছবি পাঠিয়েছে]",
  document: "[ডকুমেন্ট পাঠিয়েছে]",
  video: "[ভিডিও পাঠিয়েছে]",
  audio: "[অডিও পাঠিয়েছে]",
  sticker: "[স্টিকার পাঠিয়েছে]",
};

async function logGroupMessage(
  supabase: ReturnType<typeof getSupabase>,
  groupId: string,
  workspaceId: string,
  senderPhone: string,
  text: string,
  mediaType: string | null
) {
  await supabase.from("group_messages").insert({
    group_id: groupId,
    workspace_id: workspaceId,
    direction: "inbound",
    sender_phone: senderPhone,
    content: text || null,
    media_type: mediaType,
    status: "received",
  });
}

// গ্রুপটা এখনো sync করা না থাকলে (groups টেবিলে নেই) কিছু করার নেই, স্কিপ। প্রতিটা মেসেজ
// group_messages এ লগ হয় (ট্রিগার মিলুক বা না মিলুক) — ভবিষ্যতে AI ট্রিগার হলে যেন গ্রুপের
// আসল কথোপকথনের প্রসঙ্গ থাকে। প্রথম যে রুল (keyword বা @mention) মেসেজে মেলে সেটাই ট্রিগার
// হয় — cooldown atomically চেক+সেট হয় (fixed মোডে মানে "একই রিপ্লাই বারবার না", AI মোডে
// মানে "কত ঘন ঘন AI call হতে পারবে", LLM cost/স্প্যাম নিয়ন্ত্রণে)
async function handleGroupMessage(
  instanceName: string,
  data: Record<string, unknown>,
  key: { remoteJid?: string; participant?: string }
) {
  const { text, mediaType } = extractGroupMessageContent(data);
  if (!text.trim() && !mediaType) return; // অচেনা/অপ্রাসঙ্গিক মেসেজ টাইপ (reaction, poll, protocol ইত্যাদি)

  const groupJid = key.remoteJid;
  if (!groupJid) return;

  const senderPhone = phoneFromJid(key.participant) ?? "unknown";
  // লাইভ VPS-এ যাচাই করা হয়েছে: এই Evolution/Baileys ভার্সনে mentionedJid ফিল্ড সবসময়
  // খালি আসে (২০২৬-০৯-২৭ এর লগে দেখা গেছে) — mention আসলে টেক্সটের ভেতরেই "@<নাম্বার>"
  // হিসেবে embedded থাকে (যেমন "@128811135979553 কেমন আছেন"), তাই সেখান থেকেই বের করা হয়।
  // mentionedJid ফিল্ডটাও রাখা হলো fallback হিসেবে, কোনো ভবিষ্যৎ Evolution আপডেটে সঠিকভাবে
  // পপুলেট হলে সেটাও কাজ করবে, ক্ষতি নেই
  const mentionedJids =
    (data.message as { extendedTextMessage?: { contextInfo?: { mentionedJid?: string[] } } } | undefined)?.extendedTextMessage
      ?.contextInfo?.mentionedJid ?? [];
  const mentionedPhonesFromText = [...text.matchAll(/@(\d{7,15})/g)].map((m) => m[1]);

  const supabase = getSupabase();
  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, workspace_id, phone_number")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!number) return;

  const { data: group } = await supabase
    .from("groups")
    .select("id, workspace_id")
    .eq("whatsapp_number_id", number.id)
    .eq("group_jid", groupJid)
    .maybeSingle();

  if (!group) {
    console.log(`[group-autoreply] group=${groupJid} not synced yet (no row in groups table), skipping`);
    return;
  }

  const { data: rules } = await supabase
    .from("group_keyword_replies")
    .select("id, trigger_type, reply_mode, keyword, reply_text, cooldown_seconds")
    .eq("group_id", group.id)
    .eq("is_active", true);

  const lowerText = text.toLowerCase();
  const isMentioned = number.phone_number
    ? mentionedJids.some((jid: string) => phoneFromJid(jid) === number.phone_number) || mentionedPhonesFromText.includes(number.phone_number)
    : false;

  const matched = (rules ?? []).find((r: { trigger_type: string; keyword: string | null }) =>
    r.trigger_type === "mention" ? isMentioned : r.keyword ? lowerText.includes(r.keyword.toLowerCase()) : false
  );

  if (!matched) {
    await logGroupMessage(supabase, group.id, group.workspace_id, senderPhone, text, mediaType);
    // ডায়াগনস্টিক লগ — কোনো mention-trigger রুল থাকা সত্ত্বেও মেলেনি মানে হয় mention করা হয়নি,
    // অথবা বট নিজের নাম্বার আর @<নাম্বার> এর ফরম্যাট মিলছে না (যেমন leading zero/country code
    // ভিন্নতা)। rules থাকলেই শুধু লগ হয়, তাই সাধারণ গ্রুপের মেসেজে স্প্যাম হয় না
    if (rules && rules.some((r: { trigger_type: string }) => r.trigger_type === "mention")) {
      console.log(
        `[group-autoreply] no rule matched (mention check) group=${groupJid}: mentionedPhonesFromText=${JSON.stringify(mentionedPhonesFromText)}, mentionedJids=${JSON.stringify(mentionedJids)}, botPhone=${number.phone_number}`
      );
    }
    return;
  }

  // atomic conditional UPDATE — cooldown শেষ হয়ে থাকলেই (বা কখনো ট্রিগার না হয়ে থাকলে) এই
  // আপডেট একটা row রিটার্ন করে, তখনই আমরা "জিতেছি" ধরে রিপ্লাই পাঠাই। দুইটা worker/ডুপ্লিকেট
  // webhook একই সময়ে এলেও শুধু একটাই এই রেসে জিতবে (DB level atomicity)
  const cooldownCutoff = new Date(Date.now() - matched.cooldown_seconds * 1000).toISOString();
  const { data: won } = await supabase
    .from("group_keyword_replies")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", matched.id)
    .or(`last_triggered_at.is.null,last_triggered_at.lt.${cooldownCutoff}`)
    .select("id")
    .maybeSingle();

  if (!won) {
    console.log(`[group-autoreply] cooldown active for rule=${matched.id} in group=${groupJid}, skipping`);
    await logGroupMessage(supabase, group.id, group.workspace_id, senderPhone, text, mediaType);
    return;
  }

  if (matched.reply_mode === "fixed") {
    await logGroupMessage(supabase, group.id, group.workspace_id, senderPhone, text, mediaType);

    const jobData: GroupReplyJobData = {
      workspaceId: number.workspace_id,
      whatsappNumberId: number.id,
      groupId: group.id,
      groupJid,
      replyText: matched.reply_text ?? "",
    };
    await getAutoReplyQueue().add("group-reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[group-autoreply] fixed reply (rule=${matched.id}) in group=${groupJid}, reply job queued`);
    return;
  }

  // AI মোড — ১:১ চ্যাটবটের একই tryAiReply কোর reuse হয়, শুধু history গ্রুপের নিজস্ব
  // group_messages থেকে আসে। একাধিক সদস্য থাকায় "কে কী বলেছে" স্পষ্ট রাখতে প্রতিটা
  // inbound turn সেন্ডারের নাম্বার দিয়ে prefix করা হয় (১:১ তে একজনই কাস্টমার বলে দরকার নেই)
  const { data: historyRows } = await supabase
    .from("group_messages")
    .select("direction, sender_phone, sender_name, content, media_type")
    .eq("group_id", group.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  const history: ChatTurn[] = (historyRows ?? [])
    .reverse()
    .map(
      (m: { direction: string; sender_phone: string | null; sender_name: string | null; content: string | null; media_type: string | null }) => {
        const shown = m.content || (m.media_type ? GROUP_MEDIA_LABEL_BN[m.media_type] : "") || "";
        return {
          role: m.direction === "inbound" ? "user" : "assistant",
          content: m.direction === "inbound" ? `[${m.sender_name || m.sender_phone || "member"}]: ${shown}` : shown,
        };
      }
    );

  await logGroupMessage(supabase, group.id, group.workspace_id, senderPhone, text, mediaType);

  // mention ট্রিগারে মেসেজে "@৮৮০১..." টাইপ raw নাম্বার থাকে, LLM কে বিভ্রান্ত না করতে ছেঁটে ফেলা হয়
  const cleanedQuestion = text.replace(/@\d{7,15}/g, "").trim() || text;

  const result = await tryAiReply(supabase, group.workspace_id, null, number.id, senderPhone, history, cleanedQuestion);

  let replyText: string;
  if (result.kind === "answer" || result.kind === "needs_human") {
    replyText = result.text;
  } else {
    replyText = result.supportPhone
      ? `দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না। সরাসরি যোগাযোগ করুন: ${result.supportPhone}`
      : "দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না।";
    await createNotification(
      group.workspace_id,
      "conversation_handed_off",
      "গ্রুপে AI চ্যাটবট টেকনিক্যাল সমস্যায় পড়েছে",
      `গ্রুপে AI সাড়া দিতে পারেনি (API key/quota/network সমস্যা) — AI Chatbot সেটিংস চেক করুন।`
    );
  }

  const jobData: GroupReplyJobData = {
    workspaceId: number.workspace_id,
    whatsappNumberId: number.id,
    groupId: group.id,
    groupJid,
    replyText,
  };
  await getAutoReplyQueue().add("group-reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  console.log(`[group-autoreply] AI reply (rule=${matched.id}, kind=${result.kind}) in group=${groupJid}, reply job queued`);
}

// একই WhatsApp মেসেজ (key.id) নিয়ে Evolution/Baileys মাঝেমধ্যে messages.upsert
// ইভেন্ট দুইবার পাঠায় (reconnect resync/retry) — এখানে ইনসার্ট করার সময় ইউনিক
// কনস্ট্রেইন্ট ভায়োলেশন (23505) ধরে সেটা শনাক্ত করা হয়, যাতে ডুপ্লিকেট AI রিপ্লাই/
// ডুপ্লিকেট মেসেজ কাস্টমারকে না যায়
async function insertInboundMessage(
  supabase: ReturnType<typeof getSupabase>,
  conversationId: string,
  text: string,
  providerMessageId: string | undefined
): Promise<{ isDuplicate: boolean }> {
  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    sender_type: "customer",
    content: text,
    provider_message_id: providerMessageId ?? null,
  });

  if (error?.code === "23505") {
    console.log(`[autoreply] duplicate inbound message ignored (conversation=${conversationId}, providerMessageId=${providerMessageId})`);
    return { isDuplicate: true };
  }
  if (error) {
    console.error(`[autoreply] failed to insert inbound message (conversation=${conversationId}):`, error.message);
  }
  return { isDuplicate: false };
}

// contact না থাকলে অটো-তৈরি করে, conversation খুঁজে/বানায়, ইতিহাসে লেখে, AI/knowledge-base
// RAG দিয়ে reply জেনারেট করে পাঠানোর job বসায়। প্রতিটা কানেক্টেড নাম্বারে এটা সবসময় চলে
// (কোনো per-number on/off নেই) — workspace এ AI সেটআপ না থাকলে সেটাও একটা টেকনিক্যাল
// ব্যর্থতা হিসেবে গণ্য হয়ে সাপোর্ট-নাম্বার সহ safety-net মেসেজ পাঠাবে, কাস্টমার কখনো
// একদম নিরুত্তর থাকবে না
async function handleAutoReply(
  supabase: ReturnType<typeof getSupabase>,
  number: { id: string; workspace_id: string },
  phone: string,
  text: string,
  providerMessageId: string | undefined
) {
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
    console.log(`[autoreply] conversation upsert failed (number=${number.id}, contact=${contact.id})`);
    return;
  }

  console.log(`[autoreply] conversation=${conversation.id} status=${conversation.status}, text="${text}"`);

  // এজেন্ট হ্যান্ডল করছে এমন কথোপকথনে bot চুপ থাকবে — এজেন্ট Inbox থেকে "আবার চালু করুন"
  // না চাপা পর্যন্ত পরের সব মেসেজেও চুপ থাকবে (ইচ্ছাকৃতভাবে sticky, ইনবাউন্ড মেসেজ তবুও সেভ হয়)
  if (conversation.status === "handed_off") {
    console.log(`[autoreply] conversation=${conversation.id} is handed_off, bot staying silent`);
    await insertInboundMessage(supabase, conversation.id, text, providerMessageId);
    return;
  }

  // resolved থেকে আবার active — নতুন মেসেজ এসেছে মানে কথোপকথন আবার চলছে
  if (conversation.status === "resolved") {
    await supabase.from("conversations").update({ status: "active" }).eq("id", conversation.id);
  }

  // বর্তমান মেসেজ ইনসার্ট করার *আগে* ইতিহাস টেনে আনা হচ্ছে, যাতে এই মেসেজটা নিজেই
  // history-তে ডুপ্লিকেট হয়ে না যায় (এটা আলাদাভাবে "question" হিসেবে পাঠানো হবে)
  const { data: historyRows } = await supabase
    .from("conversation_messages")
    .select("direction, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);
  const history: ChatTurn[] = (historyRows ?? [])
    .reverse()
    .map((m: { direction: string; content: string }) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content }));

  const { isDuplicate } = await insertInboundMessage(supabase, conversation.id, text, providerMessageId);
  if (isDuplicate) {
    console.log(`[autoreply] skipping AI call — duplicate webhook event for an already-processed message`);
    return;
  }

  // n8n AI Agent node এর মতো — কোনো keyword rule/rigid logic নেই, system prompt-ই
  // একমাত্র নিয়ন্ত্রক। LLM নিজে সিদ্ধান্ত নেয় উত্তর দেবে, না জানলে (system prompt এর
  // নির্দেশ অনুযায়ী) ভদ্রভাবে বলবে, নাকি এটা প্রকৃত টেকনিক্যাল ব্যর্থতা।
  const result = await tryAiReply(supabase, number.workspace_id, conversation.id, number.id, phone, history, text);

  if (result.kind === "answer") {
    const jobData: AutoReplyJobData = {
      conversationId: conversation.id,
      workspaceId: number.workspace_id,
      whatsappNumberId: number.id,
      phone,
      replyText: result.text,
      markHandedOff: false,
    };
    await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[autoreply] AI answered, reply job queued`);
    return;
  }

  if (result.kind === "needs_human") {
    // LLM নিজের ভাষায় "জানি না" বলেছে (system prompt অনুযায়ী) — সেই টেক্সটাই কাস্টমারকে
    // পাঠানো হবে, কোনো আলাদা fixed মেসেজ না
    const jobData: AutoReplyJobData = {
      conversationId: conversation.id,
      workspaceId: number.workspace_id,
      whatsappNumberId: number.id,
      phone,
      replyText: result.text,
      markHandedOff: true,
    };
    await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[autoreply] AI said it needs a human (natural-language reply), reply job queued, will be handed_off`);
    return;
  }

  // technical_failure — key নেই/ভুল, quota শেষ, network timeout ইত্যাদি প্রকৃত ব্যর্থতা।
  // এটাই একমাত্র জায়গা যেখানে একটা fixed generic মেসেজ পাঠানো হয়, LLM এর কথায় না
  console.log(`[autoreply] technical failure, sending generic safety-net message`);
  const safetyNetText = result.supportPhone
    ? `দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না। সরাসরি যোগাযোগ করুন: ${result.supportPhone}`
    : "দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না। শীঘ্রই একজন প্রতিনিধি যোগাযোগ করবেন।";
  const jobData: AutoReplyJobData = {
    conversationId: conversation.id,
    workspaceId: number.workspace_id,
    whatsappNumberId: number.id,
    phone,
    replyText: safetyNetText,
    markHandedOff: true,
  };
  await getAutoReplyQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  await createNotification(
    number.workspace_id,
    "conversation_handed_off",
    "AI চ্যাটবট টেকনিক্যাল সমস্যায় পড়েছে",
    "কাস্টমারের মেসেজে AI সাড়া দিতে পারেনি (API key/quota/network সমস্যা) — Inbox এ গিয়ে দেখুন আর AI Chatbot সেটিংস চেক করুন।"
  );
}

type AiReplyResult =
  | { kind: "answer"; text: string }
  | { kind: "needs_human"; text: string }
  | { kind: "technical_failure"; supportPhone: string | null };

// একজন হিউম্যান এজেন্টের মতো — কোনো hardcoded rule/rigid logic নেই, system prompt +
// knowledge base + কথোপকথনের ইতিহাস দেখে LLM নিজেই বুদ্ধি খাটিয়ে সিদ্ধান্ত নেয়। কম/মাঝারি
// সাইজের knowledge base হলে (FULL_TEXT_MODE_MAX_WORDS এর মধ্যে) পুরো ডকুমেন্ট টেক্সট সরাসরি
// context হিসেবে দেওয়া হয়, যাতে প্রশ্নের ধরন যাই হোক (নির্দিষ্ট আইটেম, পুরো লিস্ট, তুলনা,
// ঘুরিয়ে জিজ্ঞেস করা) LLM পুরো তথ্য "পড়ে" উত্তর বুঝতে পারে। বড় হলে top-K chunk retrieval
// দিয়ে context বানানো হয় (কোনো hard similarity গেট নেই — LLM নিজেই প্রাসঙ্গিকতা বিচার করে)।
// LLM নিজে না জানলে system prompt এর নির্দেশ অনুযায়ী প্রাকৃতিক ভাষায় বলে, শুধু নিজের উত্তরের
// শুরুতে NO_ANSWER_MARKER বসায় (কাস্টমার দেখে না, কোড ছেঁটে ফেলে) — এটাই "needs_human"
// সিগন্যাল, প্রাকৃতিক ভাষা পার্স করার অনির্ভরযোগ্যতা এড়াতে। শুধু প্রকৃত টেকনিক্যাল ব্যর্থতায়
// (key নেই/ভুল, API এরর, কোনো response-ই আসেনি) "technical_failure" রিটার্ন হয়।
// conversationId নাল হয় গ্রুপ-কনটেক্সটে কল করলে (গ্রুপের কোনো conversations row নেই) — অর্ডার
// সেভ হলে orders.conversation_id শুধু তখন নাল থাকবে, বাকি সব লজিক অভিন্ন
async function tryAiReply(
  supabase: ReturnType<typeof getSupabase>,
  workspaceId: string,
  conversationId: string | null,
  whatsappNumberId: string,
  phone: string,
  history: ChatTurn[],
  question: string
): Promise<AiReplyResult> {
  let supportPhone: string | null = null;

  try {
    const { data: settings } = await supabase
      .from("workspace_ai_settings")
      .select("llm_provider, system_prompt, support_phone, typical_delivery_time")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    supportPhone = settings?.support_phone ?? null;

    if (!settings?.llm_provider) {
      console.log(`[autoreply] workspace=${workspaceId} has no AI provider configured`);
      return { kind: "technical_failure", supportPhone };
    }

    const provider = settings.llm_provider as LlmProvider;

    const { data: apiKey } = await supabase.rpc("get_workspace_api_key", { p_workspace_id: workspaceId });
    if (!apiKey) {
      console.log(`[autoreply] workspace=${workspaceId} has a provider set but no API key`);
      return { kind: "technical_failure", supportPhone };
    }

    const { data: documents } = await supabase
      .from("knowledge_base_documents")
      .select("file_name, full_text, word_count")
      .eq("workspace_id", workspaceId)
      .eq("status", "ready");

    const readyDocs = (documents ?? []).filter((d: { full_text: string | null }) => d.full_text);
    const totalWords = readyDocs.reduce((sum: number, d: { word_count: number }) => sum + d.word_count, 0);

    console.log(
      `[autoreply] workspace=${workspaceId}: ${readyDocs.length} ready document(s), ${totalWords} total words (full-text mode limit: ${FULL_TEXT_MODE_MAX_WORDS})`
    );

    let context = "";
    if (readyDocs.length > 0 && totalWords <= FULL_TEXT_MODE_MAX_WORDS) {
      context = readyDocs.map((d: { file_name: string; full_text: string | null }) => `# ${d.file_name}\n${d.full_text}`).join("\n\n---\n\n");
    } else if (readyDocs.length > 0) {
      context = await buildChunkContext(supabase, workspaceId, provider, apiKey, question);
    }
    // readyDocs.length === 0 হলে context ফাঁকা থাকে — LLM তবুও কল হয়, শুধু system prompt
    // দিয়েই (সাধারণ কথাবার্তা/অর্ডার প্রসেসের নির্দেশনা system prompt-এই থাকতে পারে)

    // এই কাস্টমারের আগের অর্ডার আছে কিনা — থাকলে সেই সত্যিকারের ডাটাবেস তথ্য context এ
    // যোগ হয়, যাতে "অর্ডারের কী অবস্থা?" জিজ্ঞেস করলে LLM অনুমান না করে সঠিক উত্তর দিতে পারে
    const orderContext = await buildOrderContext(supabase, workspaceId, phone);
    const deliveryTimeContext = settings.typical_delivery_time
      ? `### দোকানের সাধারণ তথ্য:\nসাধারণ ডেলিভারি সময়: ${settings.typical_delivery_time}`
      : "";
    const shopInfoContext = [orderContext, deliveryTimeContext].filter(Boolean).join("\n\n---\n\n");
    if (shopInfoContext) {
      context = context ? `${shopInfoContext}\n\n---\n\n${context}` : shopInfoContext;
    }

    const promptWithMarker = `${settings.system_prompt ?? ""}

উপরের তথ্যে প্রশ্নের সঠিক উত্তর না থাকলে, system prompt এর নির্দেশ অনুযায়ী ভদ্রভাবে জানাও যে নিশ্চিত না — কিন্তু তোমার উত্তরের একদম প্রথম শব্দ হিসেবে অবশ্যই এটা বসাও (কাস্টমার এটা দেখবে না): ${NO_ANSWER_MARKER}

কাস্টমার যদি অর্ডার কনফার্ম করে (সব প্রয়োজনীয় তথ্য দিয়ে নিশ্চিত করেছে — কবে/কীভাবে অর্ডার নিতে হবে সেটা তোমার নিজের সিদ্ধান্ত, system prompt এর নির্দেশ অনুযায়ী), তাহলে কাস্টমারকে দেওয়া স্বাভাবিক উত্তরের একদম শেষে (নতুন লাইনে) এই ফরম্যাটে একটা ব্লক যোগ করবে (কাস্টমার এটা দেখবে না, শুধু সিস্টেম বুঝতে ব্যবহার করবে):
${ORDER_BLOCK_START}{"product_name": "...", "quantity": "...", "delivery_name": "...", "delivery_phone": "...", "delivery_address": "..."}${ORDER_BLOCK_END}
কোনো তথ্য না জানলে সেই ফিল্ডে খালি স্ট্রিং ("") দেবে। এই ব্লকটা শুধু তখনই দেবে যখন অর্ডার সত্যিই কনফার্ম হয়েছে, প্রতিটা মেসেজে না।

কাস্টমার যদি তার আগের অর্ডারের status/অবস্থা জিজ্ঞেস করে, উপরে "সাম্প্রতিক অর্ডার" শিরোনামে দেওয়া
তথ্য (যদি থাকে) থেকে সরাসরি সঠিক উত্তর দাও — কখনো অনুমান কোরো না। সেই তথ্য না থাকলে সততার সাথে
বলো যে তোমার কোনো অর্ডার খুঁজে পাওনি।

কাস্টমার ডেলিভারি সময়/"কবে পাবো" জিজ্ঞেস করলে, উপরে "দোকানের সাধারণ তথ্য" শিরোনামে দেওয়া
ডেলিভারি সময় (যদি থাকে) আর কাস্টমারের অর্ডার status মিলিয়ে স্বাভাবিক, পেশাদার উত্তর দাও (যেমন:
"আপনার অর্ডার #৪ বর্তমানে প্রক্রিয়াধীন, সাধারণত ৩-৫ কার্যদিবসের মধ্যে পৌঁছে যায়।")। "কোনো তথ্য নেই"
জাতীয় রুক্ষ উত্তর শুধু তখনই দেবে যখন এই ডেলিভারি সময়ের তথ্যও না থাকে।`;

    const reply = await generateChatReply(provider, apiKey, promptWithMarker, context, history, question);
    const trimmed = reply.trim();
    console.log(`[autoreply] LLM reply (first 150 chars): "${trimmed.slice(0, 150)}"`);

    if (!trimmed) {
      return { kind: "technical_failure", supportPhone };
    }

    if (trimmed.includes(NO_ANSWER_MARKER)) {
      const naturalText = trimmed.replace(NO_ANSWER_MARKER, "").trim();
      return { kind: "needs_human", text: naturalText || "দুঃখিত, এই মুহূর্তে সঠিক তথ্য দিতে পারছি না।" };
    }

    const { cleanText, rawBlock, parsed, parseError } = extractOrderBlock(trimmed);
    let finalText = cleanText || trimmed;
    if (rawBlock) {
      const orderNumber = await saveOrder(supabase, workspaceId, conversationId, whatsappNumberId, phone, rawBlock, parsed, parseError);
      if (orderNumber !== null) {
        finalText += `\n\nআপনার অর্ডার আইডি: #${orderNumber.toLocaleString("bn-BD")} — এটা দিয়ে পরে "আমার অর্ডারের কী অবস্থা?" জিজ্ঞেস করলে জানতে পারবেন।`;
      }
    }

    return { kind: "answer", text: finalText };
  } catch (err) {
    console.error(`[autoreply] AI call failed (workspace=${workspaceId}):`, err instanceof Error ? err.message : err);
    return { kind: "technical_failure", supportPhone };
  }
}

// LLM এর ORDER_CONFIRMED ব্লক পেলে এখানে সেভ হয়। JSON পার্স ব্যর্থ হলেও raw_summary
// হিসেবে আসল টেক্সট সেভ হয় (silent fail না করে worker লগে স্পষ্ট এরর লেখা হয়) — যাতে
// অন্তত ডাটা না হারায়, পরে দরকার হলে ম্যানুয়ালি দেখা যায়। সফল হলে ছোট readable
// order_number রিটার্ন করে যাতে caller সেটা কাস্টমারকে জানাতে পারে
async function saveOrder(
  supabase: ReturnType<typeof getSupabase>,
  workspaceId: string,
  conversationId: string | null,
  whatsappNumberId: string,
  phone: string,
  rawBlock: string,
  parsed: ParsedOrder | null,
  parseError: string | null
): Promise<number | null> {
  if (parseError) {
    console.error(`[autoreply] ORDER_CONFIRMED JSON parse failed (workspace=${workspaceId}, conversation=${conversationId}): ${parseError}. raw="${rawBlock}"`);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      whatsapp_number_id: whatsappNumberId,
      contact_phone: phone,
      product_name: parsed?.product_name || null,
      quantity: parsed?.quantity || null,
      delivery_name: parsed?.delivery_name || null,
      delivery_phone: parsed?.delivery_phone || null,
      delivery_address: parsed?.delivery_address || null,
      raw_summary: rawBlock,
    })
    .select("id, order_number")
    .maybeSingle();

  if (error || !order) {
    console.error(`[autoreply] failed to save order (workspace=${workspaceId}, conversation=${conversationId}):`, error?.message);
    return null;
  }

  await supabase.from("order_status_history").insert({
    order_id: order.id,
    workspace_id: workspaceId,
    from_status: null,
    to_status: "pending",
  });

  console.log(`[autoreply] order #${order.order_number} saved (workspace=${workspaceId}, conversation=${conversationId}, parsed=${!parseError})`);
  await createNotification(
    workspaceId,
    "new_order",
    `নতুন অর্ডার #${order.order_number}`,
    parsed?.product_name ? `${parsed.product_name}${parsed.quantity ? ` (${parsed.quantity})` : ""} — কাস্টমার: ${phone}` : `কাস্টমার ${phone} থেকে নতুন অর্ডার — বিস্তারিত দেখতে Orders পেজে যান।`
  );

  return order.order_number;
}

// প্রতিটা ইনকামিং মেসেজে এই ফোন নাম্বারের সাম্প্রতিক অর্ডার(গুলো) ডাটাবেস থেকে সরাসরি
// টেনে এনে LLM এর context এ যোগ করা হয় — যাতে "অর্ডারের কী অবস্থা?" জিজ্ঞেস করলে LLM
// conversation history থেকে অনুমান না করে সঠিক, up-to-date তথ্য দিয়ে উত্তর দিতে পারে
const ORDER_STATUS_LABEL_BN: Record<string, string> = {
  pending: "নতুন/প্রক্রিয়াধীন",
  confirmed: "কনফার্ম হয়েছে",
  shipped: "পাঠানো হয়েছে",
  cancelled: "বাতিল হয়েছে",
};

async function buildOrderContext(supabase: ReturnType<typeof getSupabase>, workspaceId: string, phone: string): Promise<string> {
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, product_name, quantity, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone", phone)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!orders || orders.length === 0) return "";

  const lines = orders.map(
    (o: { order_number: number; product_name: string | null; quantity: string | null; status: string; created_at: string }) =>
      `- অর্ডার #${o.order_number}: ${o.product_name || "(নাম নেই)"}${o.quantity ? ` × ${o.quantity}` : ""}, বর্তমান status: ${ORDER_STATUS_LABEL_BN[o.status] ?? o.status} (তারিখ: ${new Date(o.created_at).toLocaleDateString("bn-BD")})`
  );

  return `### এই কাস্টমারের সাম্প্রতিক অর্ডার (সরাসরি ডাটাবেস থেকে, সবসময় নির্ভুল — অনুমান কোরো না):\n${lines.join("\n")}`;
}

async function buildChunkContext(
  supabase: ReturnType<typeof getSupabase>,
  workspaceId: string,
  provider: LlmProvider,
  apiKey: string,
  question: string
): Promise<string> {
  const queryEmbedding = await generateEmbedding(provider, apiKey, question);

  // ৪ থেকে ৮ এ বাড়ানো হয়েছে — multi-part প্রশ্নে (যেমন দুই প্রোডাক্টের তুলনা, বা প্রোডাক্ট+ডেলিভারি
  // একসাথে) একটা মাত্র query embedding একাধিক উপ-বিষয়ে স্কিউড হতে পারে, বেশি chunk আনলে সব
  // প্রাসঙ্গিক অংশ LLM এর কাছে পৌঁছানোর সম্ভাবনা বাড়ে
  const { data: matches } = await supabase.rpc("search_knowledge_base", {
    p_workspace_id: workspaceId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_provider: provider,
    p_match_count: 8,
  });

  console.log(`[autoreply] chunk retrieval (large KB): found ${matches?.length ?? 0} chunk(s)`);
  return (matches ?? []).map((m: { content: string }) => m.content).join("\n\n---\n\n");
}
