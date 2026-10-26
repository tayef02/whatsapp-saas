import { createClient } from "@/lib/supabase/server";

// ইমেইল কন্টাক্ট/টেমপ্লেটের সার্ভার অ্যাকশনের শুরুতে: লগইন করা ইউজার + তার workspace। লেখা service_role
// দিয়ে হয় (টেবিলে ব্রাউজারের শুধু SELECT), তাই workspace_id সবসময় এখান থেকে আসে — ফর্ম থেকে নয়,
// যাতে কেউ অন্য workspace এর ডাটায় লিখতে না পারে।
export async function getEmailMemberContext(): Promise<
  { workspaceId: string; userId: string; userEmail: string | null } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  if (!membership) return { error: "workspace পাওয়া যায়নি" };

  return { workspaceId: membership.workspace_id, userId: user.id, userEmail: user.email ?? null };
}
