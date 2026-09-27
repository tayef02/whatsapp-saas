"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  return data?.workspace_id as string | undefined;
}

// নির্দিষ্ট সময়ে এক বা একাধিক গ্রুপে টেক্সট/পোল পাঠানোর শিডিউল বানায় — আসল পাঠানো worker এর
// scheduler tick + queue করে (staggered delay সহ, দৈনিক লিমিট মেনে)
export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "workspace পাওয়া যায়নি" };

  const messageText = String(formData.get("messageText") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const groupIds = formData.getAll("groupIds").map(String);
  const isPoll = formData.get("isPoll") === "on";
  const pollOptionsRaw = String(formData.get("pollOptions") ?? "");
  const pollMultiSelect = formData.get("pollMultiSelect") === "on";

  if (!messageText) return { error: isPoll ? "পোলের প্রশ্ন দিন" : "মেসেজ টেক্সট দিন" };
  if (!scheduledAt) return { error: "কখন পাঠাতে হবে সেই সময় বাছাই করুন" };
  if (groupIds.length === 0) return { error: "অন্তত একটা গ্রুপ বাছাই করুন" };

  const pollOptions = isPoll
    ? pollOptionsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  if (isPoll && (!pollOptions || pollOptions.length < 2)) return { error: "পোলে অন্তত ২টা অপশন দিন (কমা দিয়ে আলাদা করে)" };

  const { data: ann, error } = await supabase
    .from("group_scheduled_announcements")
    .insert({
      workspace_id: workspaceId,
      message_text: messageText,
      poll_options: pollOptions,
      poll_multi_select: pollMultiSelect,
      scheduled_at: new Date(scheduledAt).toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !ann) return { error: error?.message ?? "সেভ করা যায়নি" };

  const { error: targetError } = await supabase
    .from("group_scheduled_announcement_targets")
    .insert(groupIds.map((groupId) => ({ announcement_id: ann.id, group_id: groupId, workspace_id: workspaceId })));

  if (targetError) return { error: targetError.message };

  revalidatePath("/dashboard/groups/announcements");
  return { error: null };
}

export async function cancelAnnouncement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("group_scheduled_announcements").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/groups/announcements");
  return { error: null };
}
