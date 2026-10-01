import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase";
import { tryAiReply } from "../lib/ai-reply";
import { createNotification } from "../lib/notify";
import { MAX_HISTORY_MESSAGES } from "@whatsapp-saas/core/chatbot/constants";
import type { ChatTurn } from "@whatsapp-saas/core/chatbot/llm";
import type { MessengerWebhookJobData, MessengerReplyJobData, DownloadMessengerMediaJobData } from "@whatsapp-saas/core/messenger/types";
import { MESSENGER_JOBS_QUEUE_NAME } from "../queues/messenger-jobs-queue";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
let messengerJobsQueue: Queue | null = null;
function getMessengerJobsQueue() {
  if (!messengerJobsQueue) messengerJobsQueue = new Queue(MESSENGER_JOBS_QUEUE_NAME, { connection });
  return messengerJobsQueue;
}

// Messenger এর attachment "type" এর বাংলা লেবেল — WhatsApp গ্রুপ/ইনবক্স মিডিয়ার MEDIA_LABEL_BN
// এর ঠিক একই স্টাইল। ক্যাপশন না থাকলে কাস্টমারের মেসেজে এই প্লেসহোল্ডারই content হিসেবে সেভ হয়।
const MEDIA_LABEL_BN: Record<string, string> = {
  image: "[ছবি পাঠিয়েছে]",
  video: "[ভিডিও পাঠিয়েছে]",
  audio: "[অডিও পাঠিয়েছে]",
  file: "[ফাইল পাঠিয়েছে]",
};

// Meta এর attachment.type ("file") আর আমাদের messenger_messages.media_type কলামের CHECK
// constraint ("document") এর নাম আলাদা — M1 এ সরাসরি attachment.type বসানো হচ্ছিল, যেটা
// "file" টাইপ attachment এলে constraint violation দিত (এই বাগটা M2 তে ধরা পড়ে ঠিক হলো)
const DB_MEDIA_TYPE: Record<string, "image" | "document" | "video" | "audio"> = {
  image: "image",
  video: "video",
  audio: "audio",
  file: "document",
};

// Messenger থেকে ইনকামিং টেক্সট/মিডিয়া মেসেজ — messenger_conversations upsert, messenger_messages
// এ dedup সহ insert (bot_enabled/status যাই হোক, মেসেজ সবসময় সেভ হয়, নইলে ইনবক্সেই দেখা
// যাবে না), নতুন কথোপকথনে কাস্টমারের নাম আনার চেষ্টা। bot_enabled (পেজ-ভিত্তিক) আর
// conversation.status (handed_off/resolved/active) দেখে শুধু AI রিপ্লাই/typing পাঠানো হয়
// কিনা ঠিক হয় — WhatsApp এর handleIncomingMessage/handleAutoReply এর ঠিক একই নিয়ম
export async function processMessengerWebhookEvent(data: MessengerWebhookJobData) {
  if (!data.message) return; // messaging_postbacks ইত্যাদি অন্য ইভেন্ট টাইপ, এখনো হ্যান্ডল হয় না

  const supabase = getSupabase();

  const { data: page, error: pageError } = await supabase
    .from("messenger_pages")
    .select("id, workspace_id, bot_enabled")
    .eq("page_id", data.pageId)
    .maybeSingle();

  if (pageError) {
    console.error(`[messenger-webhook] messenger_pages lookup failed page=${data.pageId}: ${pageError.message}`);
    throw new Error(`messenger_pages lookup failed: ${pageError.message}`);
  }
  if (!page) {
    console.log(`[messenger-webhook] no connected page for page_id=${data.pageId}, skipping`);
    return;
  }

  let content = data.message.text ?? "";
  let mediaType: "image" | "document" | "video" | "audio" | null = null;
  const attachment = data.message.attachments?.[0];
  if (!content && attachment) {
    mediaType = DB_MEDIA_TYPE[attachment.type] ?? null;
    content = MEDIA_LABEL_BN[attachment.type] ?? `[${attachment.type} পাঠিয়েছে]`;
  }
  if (!content.trim()) return; // টেক্সট/attachment কিছুই নেই (sticker_id, quick_reply payload ইত্যাদি) — এখনো হ্যান্ডল হয় না

  const { data: conversation, error: convError } = await supabase
    .from("messenger_conversations")
    .upsert(
      {
        workspace_id: page.workspace_id,
        messenger_page_id: page.id,
        psid: data.senderPsid,
        last_message_at: new Date().toISOString(),
        last_user_message_at: new Date().toISOString(),
      },
      { onConflict: "messenger_page_id,psid" }
    )
    .select("id, status, customer_name")
    .maybeSingle();

  if (convError || !conversation) {
    console.error(`[messenger-webhook] messenger_conversations upsert failed page=${page.id}: ${convError?.message}`);
    throw new Error(`messenger_conversations upsert failed: ${convError?.message ?? "unknown"}`);
  }

  // নতুন কথোপকথনে কাস্টমারের নাম Graph API থেকে আনার চেষ্টা — getUserProfile() নিজেই সব
  // এরর ধরে null রিটার্ন করে (messenger.ts), তাই এখানে try/catch লাগছে না
  if (!conversation.customer_name) {
    const appId = process.env.MESSENGER_APP_ID;
    const appSecret = process.env.MESSENGER_APP_SECRET;
    if (appId && appSecret) {
      const { data: token } = await supabase.rpc("get_messenger_page_token", { p_page_id: page.id });
      if (token) {
        const provider = new MetaMessengerProvider({ appId, appSecret });
        const { name } = await provider.getUserProfile(token, data.senderPsid);
        if (name) {
          const { error: nameError } = await supabase.from("messenger_conversations").update({ customer_name: name }).eq("id", conversation.id);
          if (nameError) console.error(`[messenger-webhook] customer_name আপডেট ব্যর্থ conversation=${conversation.id}: ${nameError.message}`);
        }
      }
    }
  }

  // এজেন্ট হ্যান্ডল করছে এমন কথোপকথনে bot চুপ থাকবে — ইনবক্স থেকে "আবার চালু করুন" না চাপা
  // পর্যন্ত পরের সব মেসেজেও চুপ থাকবে, তবু মেসেজ (আর মিডিয়া থাকলে সেটাও) সেভ হয়
  if (conversation.status === "handed_off") {
    console.log(`[messenger-webhook] conversation=${conversation.id} is handed_off, bot staying silent`);
    const { messageId } = await insertInboundMessage(supabase, conversation.id, content, data.message.mid, mediaType);
    if (messageId) await maybeQueueMediaDownload(messageId, mediaType, page.workspace_id, conversation.id, attachment?.payload?.url);
    return;
  }

  // resolved থেকে আবার active — নতুন মেসেজ এসেছে মানে কথোপকথন আবার চলছে
  if (conversation.status === "resolved") {
    await supabase.from("messenger_conversations").update({ status: "active" }).eq("id", conversation.id);
  }

  // পেজে "বট অন/অফ" টগল বন্ধ থাকলে — handed_off এর ঠিক একই প্যাটার্ন: মেসেজ (ও মিডিয়া
  // থাকলে সেটাও) সেভ হয় (ইনবক্সে দেখা যাবে), শুধু AI কল/typing/রিপ্লাই স্কিপ হয়। আগে এই
  // চেক সবার আগে বসানো ছিল, যার ফলে বট বন্ধ থাকা অবস্থায় কাস্টমারের মেসেজ ইনবক্সেই সেভ
  // হতো না (বাগ) — WhatsApp এর handleAutoReply এ একই বাগ, একই কারণে, এখানে ঠিক করা হলো
  if (!page.bot_enabled) {
    console.log(`[messenger-webhook] bot is turned off for page=${page.id}, saving message but skipping AI reply`);
    const { messageId } = await insertInboundMessage(supabase, conversation.id, content, data.message.mid, mediaType);
    if (messageId) await maybeQueueMediaDownload(messageId, mediaType, page.workspace_id, conversation.id, attachment?.payload?.url);
    return;
  }

  // বর্তমান মেসেজ ইনসার্ট করার *আগে* ইতিহাস টেনে আনা হচ্ছে, যাতে এই মেসেজটা নিজেই history-তে
  // ডুপ্লিকেট হয়ে না যায় (WhatsApp এর handleAutoReply এর ঠিক একই কারণ/প্যাটার্ন)
  const { data: historyRows } = await supabase
    .from("messenger_messages")
    .select("direction, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);
  const history: ChatTurn[] = (historyRows ?? [])
    .reverse()
    .map((m: { direction: string; content: string }) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content }));

  const { isDuplicate, messageId } = await insertInboundMessage(supabase, conversation.id, content, data.message.mid, mediaType);
  if (isDuplicate) {
    console.log(`[messenger-webhook] skipping AI call — duplicate webhook event for an already-processed message`);
    return;
  }

  if (messageId) await maybeQueueMediaDownload(messageId, mediaType, page.workspace_id, conversation.id, attachment?.payload?.url);

  // ছবি/ভিডিও/অডিও/ফাইল এসেছে কিন্তু কোনো ক্যাপশন নেই — মেসেজ ততক্ষণে সেভ হয়ে গেছে, কিন্তু AI
  // কে খালি প্রশ্ন পাঠিয়ে কল করা হচ্ছে না (WhatsApp ইনবক্সের একই আচরণ)
  if (mediaType && !(data.message.text ?? "").trim()) {
    console.log(`[messenger-webhook] media message with no caption (type=${mediaType}), saved but skipping AI reply (conversation=${conversation.id})`);
    return;
  }

  // tryAiReply এর "phone" প্যারামিটার Messenger এ psid বহন করে (orders.contact_phone কলাম
  // reuse হয়, channel ফিল্টার দিয়ে WhatsApp/Messenger অর্ডার আলাদা থাকে — ai-reply.ts দেখুন)
  const result = await tryAiReply(supabase, page.workspace_id, null, null, page.id, data.senderPsid, history, content);

  if (result.kind === "answer") {
    const jobData: MessengerReplyJobData = {
      conversationId: conversation.id,
      messengerPageId: page.id,
      psid: data.senderPsid,
      replyText: result.text,
      senderType: "bot",
      allowHumanAgentTag: false, // AI বট রিপ্লাইয়ে উইন্ডো শেষ হলে পাঠাবে না, tag দিয়ে বাড়াবে না
      markHandedOff: false,
    };
    await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[messenger-webhook] AI answered, reply job queued`);
    return;
  }

  if (result.kind === "needs_human") {
    const jobData: MessengerReplyJobData = {
      conversationId: conversation.id,
      messengerPageId: page.id,
      psid: data.senderPsid,
      replyText: result.text,
      senderType: "bot",
      allowHumanAgentTag: false,
      markHandedOff: true,
    };
    await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
    console.log(`[messenger-webhook] AI said it needs a human, reply job queued, will be handed_off`);
    return;
  }

  // technical_failure — key নেই/ভুল, quota শেষ, network timeout ইত্যাদি প্রকৃত ব্যর্থতা
  console.log(`[messenger-webhook] technical failure, sending generic safety-net message`);
  const safetyNetText = result.supportPhone
    ? `দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না। সরাসরি যোগাযোগ করুন: ${result.supportPhone}`
    : "দুঃখিত, এই মুহূর্তে প্রযুক্তিগত সমস্যার কারণে সাড়া দিতে পারছি না। শীঘ্রই একজন প্রতিনিধি যোগাযোগ করবেন।";
  const jobData: MessengerReplyJobData = {
    conversationId: conversation.id,
    messengerPageId: page.id,
    psid: data.senderPsid,
    replyText: safetyNetText,
    senderType: "bot",
    allowHumanAgentTag: false,
    markHandedOff: true,
  };
  await getMessengerJobsQueue().add("reply", jobData, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  await createNotification(
    page.workspace_id,
    "conversation_handed_off",
    "Messenger AI চ্যাটবট টেকনিক্যাল সমস্যায় পড়েছে",
    "কাস্টমারের মেসেজে AI সাড়া দিতে পারেনি (API key/quota/network সমস্যা) — Messenger ইনবক্সে গিয়ে দেখুন।"
  );
}

async function insertInboundMessage(
  supabase: ReturnType<typeof getSupabase>,
  conversationId: string,
  content: string,
  providerMessageId: string,
  mediaType: "image" | "document" | "video" | "audio" | null
): Promise<{ isDuplicate: boolean; messageId: string | null }> {
  const { data, error } = await supabase
    .from("messenger_messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "customer",
      content,
      media_type: mediaType,
      provider_message_id: providerMessageId,
    })
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    console.log(`[messenger-webhook] duplicate inbound message ignored (conversation=${conversationId}, providerMessageId=${providerMessageId})`);
    return { isDuplicate: true, messageId: null };
  }
  if (error) {
    console.error(`[messenger-webhook] failed to insert inbound message (conversation=${conversationId}):`, error.message);
    return { isDuplicate: false, messageId: null };
  }
  return { isDuplicate: false, messageId: data?.id ?? null };
}

// মিডিয়া মেসেজ হলে (আর row ঠিকমতো সেভ হয়ে থাকলে) আসল ফাইল ডাউনলোড করে আনার job বসায় — Graph
// attachment URL এর মেয়াদ ছোট, তাই এখনই (এই job data তে) ধরে রাখা হচ্ছে, worker পরে আবার Graph
// API কল করে URL আনবে না। মূল webhook প্রসেসিং (AI রিপ্লাই) কখনো একটা ধীর ডাউনলোডের জন্য
// আটকে থাকবে না বলে এটা সরাসরি না করে queue দিয়ে হয় (WhatsApp এর maybeQueueInboxMediaDownload
// এর ঠিক একই প্যাটার্ন)
async function maybeQueueMediaDownload(
  messengerMessageId: string,
  mediaType: "image" | "document" | "video" | "audio" | null,
  workspaceId: string,
  conversationId: string,
  mediaUrl: string | undefined
) {
  if (!mediaType || !mediaUrl) return;

  const jobData: DownloadMessengerMediaJobData = { messengerMessageId, workspaceId, conversationId, mediaUrl };
  await getMessengerJobsQueue().add("download-media", jobData, { attempts: 2, backoff: { type: "exponential", delay: 3000 } });
}
