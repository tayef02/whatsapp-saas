import { getSupabase } from "./supabase";
import { createNotification } from "./notify";
import { generateEmbedding, generateChatReply, type LlmProvider, type ChatTurn } from "@whatsapp-saas/core/chatbot/llm";
import { FULL_TEXT_MODE_MAX_WORDS, NO_ANSWER_MARKER, ORDER_BLOCK_START, ORDER_BLOCK_END } from "@whatsapp-saas/core/chatbot/constants";
import { extractOrderBlock, type ParsedOrder } from "@whatsapp-saas/core/chatbot/order-block";
import { normalizeBangladeshiPhone } from "@whatsapp-saas/core/utils/phone";

// WhatsApp এর process-webhook.ts (১:১ ও গ্রুপ, দুটোই) আর Messenger এর process-messenger-webhook.ts
// — দুই চ্যানেলই এই একই AI কোর reuse করে (workspace_ai_settings/knowledge base শেয়ার্ড, M0 থেকেই
// সিদ্ধান্ত ছিল)। Phase M2 তে এখান থেকে এক্সট্র্যাক্ট করা হয়েছে (আগে process-webhook.ts এর ভেতরেই
// প্রাইভেট ফাংশন ছিল) আর সিগনেচার জেনেরিক করা হয়েছে — whatsappNumberId/messengerPageId দুটোই
// nullable, channel ভেতরেই গণনা হয় (ঠিক একটা নন-নাল থাকবে, caller নিশ্চিত করে)।

export type AiReplyResult =
  | { kind: "answer"; text: string }
  | { kind: "needs_human"; text: string }
  | { kind: "technical_failure"; supportPhone: string | null };

// একজন হিউম্যান এজেন্টের মতো — কোনো hardcoded rule/rigid logic নেই, system prompt + knowledge
// base + কথোপকথনের ইতিহাস দেখে LLM নিজেই বুদ্ধি খাটিয়ে সিদ্ধান্ত নেয়। কম/মাঝারি সাইজের knowledge
// base হলে (FULL_TEXT_MODE_MAX_WORDS এর মধ্যে) পুরো ডকুমেন্ট টেক্সট সরাসরি context হিসেবে দেওয়া
// হয়, যাতে প্রশ্নের ধরন যাই হোক LLM পুরো তথ্য "পড়ে" উত্তর বুঝতে পারে। বড় হলে top-K chunk
// retrieval দিয়ে context বানানো হয়। LLM নিজে না জানলে system prompt এর নির্দেশ অনুযায়ী
// প্রাকৃতিক ভাষায় বলে, শুধু নিজের উত্তরের শুরুতে NO_ANSWER_MARKER বসায় — এটাই "needs_human"
// সিগন্যাল। শুধু প্রকৃত টেকনিক্যাল ব্যর্থতায় "technical_failure" রিটার্ন হয়।
// conversationId নাল হয় গ্রুপ-কনটেক্সটে কল করলে (গ্রুপের কোনো conversations row নেই) — অর্ডার
// সেভ হলে orders.conversation_id শুধু তখন (বা Messenger চ্যানেলে) নাল থাকবে, বাকি সব লজিক অভিন্ন
export async function tryAiReply(
  supabase: ReturnType<typeof getSupabase>,
  workspaceId: string,
  conversationId: string | null,
  whatsappNumberId: string | null,
  messengerPageId: string | null,
  phone: string,
  history: ChatTurn[],
  question: string
): Promise<AiReplyResult> {
  const channel: "whatsapp" | "messenger" = whatsappNumberId ? "whatsapp" : "messenger";
  let supportPhone: string | null = null;

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("workspace_ai_settings")
      .select("llm_provider, system_prompt, support_phone, typical_delivery_time")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (settingsError) {
      // এরর হলে "provider সেট নেই" ধরে ভুল ধারণা না দিয়ে সরাসরি technical_failure — যেমন
      // নিচের apiKey/documents চেকগুলো (আর সবার নিচের catch ব্লক) একই পাথে যায়
      console.error(`[autoreply] workspace_ai_settings lookup failed workspace=${workspaceId}: ${settingsError.message}`);
      return { kind: "technical_failure", supportPhone };
    }

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
    const orderContext = await buildOrderContext(supabase, workspaceId, phone, channel);
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
      const orderNumber = await saveOrder(supabase, workspaceId, conversationId, whatsappNumberId, messengerPageId, phone, rawBlock, parsed, parseError);
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
  whatsappNumberId: string | null,
  messengerPageId: string | null,
  phone: string,
  rawBlock: string,
  parsed: ParsedOrder | null,
  parseError: string | null
): Promise<number | null> {
  if (parseError) {
    console.error(`[autoreply] ORDER_CONFIRMED JSON parse failed (workspace=${workspaceId}, conversation=${conversationId}): ${parseError}. raw="${rawBlock}"`);
  }

  const channel: "whatsapp" | "messenger" = whatsappNumberId ? "whatsapp" : "messenger";

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      workspace_id: workspaceId,
      // orders.conversation_id শুধু public.conversations (WhatsApp) রেফার করে — Messenger
      // কথোপকথনের id এখানে বসালে FK ভায়োলেশন হবে, তাই channel==='messenger' হলে সবসময় null
      conversation_id: channel === "whatsapp" ? conversationId : null,
      whatsapp_number_id: whatsappNumberId,
      messenger_page_id: messengerPageId,
      channel,
      contact_phone: phone,
      product_name: parsed?.product_name || null,
      quantity: parsed?.quantity || null,
      delivery_name: parsed?.delivery_name || null,
      // LLM কাস্টমারের টাইপ করা নাম্বার যেকোনো ফরম্যাটেই JSON এ বসাতে পারে — normalize করা
      // যায় তো করা হয়, না গেলে (হয়তো নাম্বার আসলেই না, অন্য কিছু) raw টেক্সটই রাখা হয়
      delivery_phone: (parsed?.delivery_phone && normalizeBangladeshiPhone(parsed.delivery_phone)) || parsed?.delivery_phone || null,
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

  console.log(`[autoreply] order #${order.order_number} saved (workspace=${workspaceId}, channel=${channel}, conversation=${conversationId})`);
  await createNotification(
    workspaceId,
    "new_order",
    `নতুন অর্ডার #${order.order_number}`,
    parsed?.product_name ? `${parsed.product_name}${parsed.quantity ? ` (${parsed.quantity})` : ""} — কাস্টমার: ${phone}` : `কাস্টমার ${phone} থেকে নতুন অর্ডার — বিস্তারিত দেখতে Orders পেজে যান।`
  );

  return order.order_number;
}

// প্রতিটা ইনকামিং মেসেজে এই ফোন নাম্বারের (বা Messenger psid এর) সাম্প্রতিক অর্ডার(গুলো)
// ডাটাবেস থেকে সরাসরি টেনে এনে LLM এর context এ যোগ করা হয় — যাতে "অর্ডারের কী অবস্থা?"
// জিজ্ঞেস করলে LLM conversation history থেকে অনুমান না করে সঠিক, up-to-date তথ্য দিয়ে উত্তর
// দিতে পারে। channel ফিল্টার দরকার কারণ একই workspace এ WhatsApp phone আর Messenger psid
// দুটোই contact_phone কলামে থাকে (Messenger এ আলাদা কোনো কলাম যোগ না করে reuse করা হয়েছে) —
// channel ছাড়া ফিল্টার করলে তাত্ত্বিকভাবে ভুল চ্যানেলের অর্ডার মিশে যেতে পারত
const ORDER_STATUS_LABEL_BN: Record<string, string> = {
  pending: "নতুন/প্রক্রিয়াধীন",
  confirmed: "কনফার্ম হয়েছে",
  shipped: "পাঠানো হয়েছে",
  cancelled: "বাতিল হয়েছে",
};

async function buildOrderContext(
  supabase: ReturnType<typeof getSupabase>,
  workspaceId: string,
  phone: string,
  channel: "whatsapp" | "messenger"
): Promise<string> {
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, product_name, quantity, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone", phone)
    .eq("channel", channel)
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
