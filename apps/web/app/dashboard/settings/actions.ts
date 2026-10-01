"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateQuietHours(formData: FormData) {
  const supabase = await createClient();
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  if (!membership) return { error: "workspace পাওয়া যায়নি" };

  const startHour = Number(formData.get("quietStart"));
  const endHour = Number(formData.get("quietEnd"));

  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) return { error: "শুরুর সময় ভুল" };
  if (!Number.isInteger(endHour) || endHour < 0 || endHour > 23) return { error: "শেষের সময় ভুল" };

  const { error } = await supabase
    .from("workspaces")
    .update({ quiet_hours_start_hour: startHour, quiet_hours_end_hour: endHour })
    .eq("id", membership.workspace_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { error: null };
}

// profiles.full_name আপডেট — RLS (profiles_update_own) নিজেই নিশ্চিত করে ইউজার শুধু নিজেরটাই বদলাতে পারে
export async function updateFullName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "নাম দিন" };

  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard"); // টপবারে নাম দেখায়, সেটাও রিফ্রেশ করা দরকার
  return { error: null };
}

// ইতিমধ্যে লগইন করা অবস্থায় পাসওয়ার্ড বদলানো — পুরনো পাসওয়ার্ড লাগে না (সেশনই যথেষ্ট প্রমাণ),
// Supabase Auth এর updateUser() ব্যবহার হচ্ছে (আগের পাসওয়ার্ড যাচাইয়ের আলাদা API নেই)
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 6) return { error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" };
  if (newPassword !== confirmPassword) return { error: "দুই পাসওয়ার্ড মিলছে না" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { error: null };
}
