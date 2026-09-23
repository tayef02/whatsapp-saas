import { getSupabase } from "./supabase";

export async function createNotification(workspaceId: string, type: string, title: string, body?: string) {
  await getSupabase().from("notifications").insert({ workspace_id: workspaceId, type, title, body });
}
