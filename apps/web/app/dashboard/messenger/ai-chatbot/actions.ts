"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMessengerKnowledgeBaseQueue } from "@/lib/queue/messenger-knowledge-base-queue";
import { KNOWLEDGE_BASE_BUCKET, MAX_KNOWLEDGE_BASE_FILE_BYTES } from "@whatsapp-saas/core/chatbot/constants";

// WhatsApp এর ai-chatbot/actions.ts এর হুবহু একই প্যাটার্ন — শুধু messenger_ai_settings/
// messenger_knowledge_base_documents/set_messenger_ai_api_key টেবিল/RPC টার্গেট করে
// (চ্যানেল বিচ্ছিন্নতা নিয়ম, CLAUDE.md)। bucket একই "knowledge-base-docs" reuse হয়, পাথ
// "{workspace_id}/messenger/{uuid}.{ext}" — WhatsApp এর পাথ (workspace_id/uuid.ext) থেকে আলাদা।

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

export async function saveMessengerAiSettings(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const llmProvider = String(formData.get("llmProvider") ?? "");
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim() || null;
  const supportPhone = String(formData.get("supportPhone") ?? "").trim() || null;
  const typicalDeliveryTime = String(formData.get("typicalDeliveryTime") ?? "").trim() || null;

  if (llmProvider !== "openai" && llmProvider !== "gemini") return { error: "provider বাছাই করুন" };

  const { data: existing } = await supabase.from("messenger_ai_settings").select("workspace_id").eq("workspace_id", workspaceId).maybeSingle();

  const payload = {
    llm_provider: llmProvider,
    system_prompt: systemPrompt,
    support_phone: supportPhone,
    typical_delivery_time: typicalDeliveryTime,
  };

  const { error } = existing
    ? await supabase.from("messenger_ai_settings").update(payload).eq("workspace_id", workspaceId)
    : await supabase.from("messenger_ai_settings").insert({ workspace_id: workspaceId, ...payload });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}

// API key কখনো ফেরত দেখানো হয় না — শুধু সেট/বদলানো যায় (Vault এ এনক্রিপ্টেড থাকে)
export async function setMessengerApiKey(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "API key দিন" };

  const { error } = await supabase.rpc("set_messenger_ai_api_key", { p_workspace_id: workspaceId, p_api_key: apiKey });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}

// এককালীন — WhatsApp এর system_prompt/support_phone/typical_delivery_time/provider টেক্সট
// ফিল্ড কপি করে। API key ইচ্ছাকৃতভাবে কপি হয় না (Vault secret, ব্যবহারকারী আবার টাইপ করবেন) —
// এটা নতুন কোনো Vault-to-Vault RPC ছাড়াই সবচেয়ে কম-ঝুঁকির পথ
export async function copySettingsFromWhatsApp() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const { data: whatsappSettings, error: fetchError } = await supabase
    .from("workspace_ai_settings")
    .select("llm_provider, system_prompt, support_phone, typical_delivery_time")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!whatsappSettings) return { error: "WhatsApp এর কোনো AI সেটিংস পাওয়া যায়নি — আগে WhatsApp এর AI Chatbot পেজে সেটআপ করুন" };

  const { data: existing } = await supabase.from("messenger_ai_settings").select("workspace_id").eq("workspace_id", workspaceId).maybeSingle();

  const payload = {
    llm_provider: whatsappSettings.llm_provider,
    system_prompt: whatsappSettings.system_prompt,
    support_phone: whatsappSettings.support_phone,
    typical_delivery_time: whatsappSettings.typical_delivery_time,
  };

  const { error } = existing
    ? await supabase.from("messenger_ai_settings").update(payload).eq("workspace_id", workspaceId)
    : await supabase.from("messenger_ai_settings").insert({ workspace_id: workspaceId, ...payload });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}

export async function uploadMessengerDocument(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "একটা ফাইল বাছাই করুন" };
  if (file.size > MAX_KNOWLEDGE_BASE_FILE_BYTES) {
    return { error: `ফাইল সাইজ সর্বোচ্চ ${MAX_KNOWLEDGE_BASE_FILE_BYTES / (1024 * 1024)}MB হতে পারবে` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const fileType = ext === "pdf" ? "pdf" : ext === "xlsx" || ext === "xls" ? "xlsx" : ext === "csv" ? "csv" : ext === "txt" ? "txt" : null;
  if (!fileType) return { error: "শুধু PDF, XLSX, CSV বা TXT ফাইল আপলোড করা যাবে" };

  const admin = createAdminClient();
  const path = `${workspaceId}/messenger/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage.from(KNOWLEDGE_BASE_BUCKET).upload(path, buffer, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: insertError } = await admin
    .from("messenger_knowledge_base_documents")
    .insert({ workspace_id: workspaceId, file_name: file.name, file_path: path, file_type: fileType, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from(KNOWLEDGE_BASE_BUCKET).remove([path]);
    return { error: insertError.message };
  }

  await getMessengerKnowledgeBaseQueue().add("process", { documentId: doc.id }, { attempts: 2 });

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}

export async function reprocessMessengerDocument(documentId: string) {
  const supabase = await createClient();
  await supabase.from("messenger_knowledge_base_documents").update({ status: "pending", error_message: null }).eq("id", documentId);
  await getMessengerKnowledgeBaseQueue().add("process", { documentId }, { attempts: 2 });

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}

export async function getMessengerDocumentChunks(documentId: string): Promise<{ id: string; content: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messenger_knowledge_base_chunks")
    .select("id, content")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function deleteMessengerDocument(documentId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: doc } = await supabase.from("messenger_knowledge_base_documents").select("file_path").eq("id", documentId).maybeSingle();
  const { error } = await supabase.from("messenger_knowledge_base_documents").delete().eq("id", documentId);
  if (error) return { error: error.message };

  if (doc?.file_path) await admin.storage.from(KNOWLEDGE_BASE_BUCKET).remove([doc.file_path]);

  revalidatePath("/dashboard/messenger/ai-chatbot");
  return { error: null };
}
