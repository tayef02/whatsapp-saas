"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKnowledgeBaseQueue } from "@/lib/queue/knowledge-base-queue";
import { KNOWLEDGE_BASE_BUCKET, MAX_KNOWLEDGE_BASE_FILE_BYTES } from "@whatsapp-saas/core/chatbot/constants";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

export async function saveAiSettings(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const llmProvider = String(formData.get("llmProvider") ?? "");
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim() || null;
  const confidenceThreshold = Number(formData.get("confidenceThreshold") ?? 0.75);

  if (llmProvider !== "openai" && llmProvider !== "gemini") return { error: "provider বাছাই করুন" };

  const { data: existing } = await supabase.from("workspace_ai_settings").select("workspace_id").eq("workspace_id", workspaceId).maybeSingle();

  const payload = { llm_provider: llmProvider, system_prompt: systemPrompt, confidence_threshold: confidenceThreshold };

  const { error } = existing
    ? await supabase.from("workspace_ai_settings").update(payload).eq("workspace_id", workspaceId)
    : await supabase.from("workspace_ai_settings").insert({ workspace_id: workspaceId, ...payload });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ai-chatbot");
  return { error: null };
}

// API key কখনো ফেরত দেখানো হয় না — শুধু সেট/বদলানো যায় (Vault এ এনক্রিপ্টেড থাকে)
export async function setApiKey(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "API key দিন" };

  const { error } = await supabase.rpc("set_workspace_api_key", { p_workspace_id: workspaceId, p_api_key: apiKey });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/ai-chatbot");
  return { error: null };
}

export async function uploadDocument(formData: FormData) {
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
  const path = `${workspaceId}/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage.from(KNOWLEDGE_BASE_BUCKET).upload(path, buffer, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: insertError } = await admin
    .from("knowledge_base_documents")
    .insert({ workspace_id: workspaceId, file_name: file.name, file_path: path, file_type: fileType, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from(KNOWLEDGE_BASE_BUCKET).remove([path]);
    return { error: insertError.message };
  }

  await getKnowledgeBaseQueue().add("process", { documentId: doc.id }, { attempts: 2 });

  revalidatePath("/dashboard/ai-chatbot");
  return { error: null };
}

export async function reprocessDocument(documentId: string) {
  const supabase = await createClient();
  await supabase.from("knowledge_base_documents").update({ status: "pending", error_message: null }).eq("id", documentId);
  await getKnowledgeBaseQueue().add("process", { documentId }, { attempts: 2 });

  revalidatePath("/dashboard/ai-chatbot");
  return { error: null };
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: doc } = await supabase.from("knowledge_base_documents").select("file_path").eq("id", documentId).maybeSingle();
  const { error } = await supabase.from("knowledge_base_documents").delete().eq("id", documentId);
  if (error) return { error: error.message };

  if (doc?.file_path) await admin.storage.from(KNOWLEDGE_BASE_BUCKET).remove([doc.file_path]);

  revalidatePath("/dashboard/ai-chatbot");
  return { error: null };
}
