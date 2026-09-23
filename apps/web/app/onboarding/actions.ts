"use server";

import { createClient } from "@/lib/supabase/server";

// নতুন ইউজার প্রথমবার লগইন করলে workspace বানায় আর নিজেকে owner হিসেবে যোগ করে।
// এই কাজটা এখন create_workspace() নামের একটা security definer DB ফাংশন (RPC) দিয়ে
// হয় — workspaces + workspace_members দুটো insert একসাথে হয়, তাই RLS নিয়ে সমস্যা হয় না।
export async function createWorkspace(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "workspace এর নাম দিন" };
  }

  const { error } = await supabase.rpc("create_workspace", {
    workspace_name: name,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
