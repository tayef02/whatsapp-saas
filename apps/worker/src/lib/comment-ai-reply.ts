import { getSupabase } from "./supabase";
import { generateChatReply, type LlmProvider } from "@whatsapp-saas/core/chatbot/llm";
import { FULL_TEXT_MODE_MAX_WORDS, NO_ANSWER_MARKER } from "@whatsapp-saas/core/chatbot/constants";

// ai-reply.ts এর tryAiReply() ইচ্ছাকৃতভাবে reuse করা হয়নি — ওটা প্রাইভেট ১:১/DM কথোপকথনের
// জন্য ডিজাইন করা (history, অর্ডার-ব্লক পার্সিং+সেভ, "needs_human" মার্কার-টেক্সট রিপ্লাই)।
// একটা পাবলিক ফেসবুক কমেন্টের রিপ্লাইয়ে এসবের কোনোটাই মানায় না — কমেন্ট থেকে ভুলবশত অর্ডার
// সেভ হয়ে যাওয়া বা "আমি জানি না, এজেন্ট লাগবে" জাতীয় টেক্সট পাবলিকলি পোস্ট হয়ে যাওয়া দুটোই
// এড়াতে এই আলাদা, ছোট ফাংশন — multi-turn history নেই (প্রতিটা কমেন্ট স্বতন্ত্র প্রশ্ন ধরা হয়),
// অনিশ্চিত হলে টেক্সট ফেরত না দিয়ে চুপচাপ স্কিপ করে (public reply না)।
export type CommentAiReplyResult = { kind: "answer"; text: string } | { kind: "skip" };

export async function tryCommentAiReply(supabase: ReturnType<typeof getSupabase>, workspaceId: string, commentText: string): Promise<CommentAiReplyResult> {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("messenger_ai_settings")
      .select("llm_provider, system_prompt")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (settingsError) {
      console.error(`[comment-ai-reply] messenger_ai_settings lookup failed workspace=${workspaceId}: ${settingsError.message}`);
      return { kind: "skip" };
    }
    if (!settings?.llm_provider) return { kind: "skip" };

    const provider = settings.llm_provider as LlmProvider;

    const { data: apiKey } = await supabase.rpc("get_messenger_ai_api_key", { p_workspace_id: workspaceId });
    if (!apiKey) return { kind: "skip" };

    const { data: documents } = await supabase
      .from("messenger_knowledge_base_documents")
      .select("file_name, full_text, word_count")
      .eq("workspace_id", workspaceId)
      .eq("status", "ready");

    const readyDocs = (documents ?? []).filter((d: { full_text: string | null }) => d.full_text);
    const totalWords = readyDocs.reduce((sum: number, d: { word_count: number }) => sum + d.word_count, 0);

    // কমেন্ট রিপ্লাইয়ে বড় knowledge base হলেও chunk-retrieval মোডে যাওয়া হচ্ছে না (স্কোপ কম
    // রাখা হয়েছে) — শুধু ছোট/মাঝারি KB (full-text mode সীমার মধ্যে) থাকলেই AI context পাবে,
    // নাহলে শুধু system prompt দিয়ে উত্তর দেবে
    let context = "";
    if (readyDocs.length > 0 && totalWords <= FULL_TEXT_MODE_MAX_WORDS) {
      context = readyDocs.map((d: { file_name: string; full_text: string | null }) => `# ${d.file_name}\n${d.full_text}`).join("\n\n---\n\n");
    }

    const promptWithMarker = `${settings.system_prompt ?? ""}

এটা একটা পাবলিক Facebook পোস্টের কমেন্টের উত্তর — সংক্ষিপ্ত (২-৩ বাক্যের বেশি না), পেশাদার, বন্ধুত্বপূর্ণ রাখো। কোনো ব্যক্তিগত/স্পর্শকাতর তথ্য (ঠিকানা, নাম্বার ইত্যাদি) পাবলিকলি লিখো না — দরকার হলে ইনবক্সে কথা বলতে বলো।

উপরের তথ্যে প্রশ্নের সঠিক উত্তর না থাকলে, বা উত্তরটা পাবলিক কমেন্টে দেওয়ার মতো না হলে, তোমার উত্তরের একদম প্রথম শব্দ হিসেবে অবশ্যই এটা বসাও (এটা কখনো পাবলিক হবে না): ${NO_ANSWER_MARKER}`;

    const reply = await generateChatReply(provider, apiKey, promptWithMarker, context, [], commentText);
    const trimmed = reply.trim();

    if (!trimmed || trimmed.includes(NO_ANSWER_MARKER)) {
      // অনিশ্চিত/ব্যর্থ — "needs_human" এর মতো কোনো fallback টেক্সট পাবলিকলি পোস্ট করা হয় না,
      // শুধু রিপ্লাই স্কিপ হয় (কমেন্ট লগে থেকে যাবে, মালিক চাইলে ম্যানুয়ালি দেখবেন)
      return { kind: "skip" };
    }

    return { kind: "answer", text: trimmed };
  } catch (err) {
    console.error(`[comment-ai-reply] AI call failed (workspace=${workspaceId}):`, err instanceof Error ? err.message : err);
    return { kind: "skip" };
  }
}
