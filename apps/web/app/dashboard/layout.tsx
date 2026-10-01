import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  // বেল এখন channel-সচেতন (সক্রিয় চ্যানেল সেকশনে শুধু সেই চ্যানেলের + channel-নিরপেক্ষ
  // নোটিফিকেশন দেখায়, আনরিড কাউন্ট ব্যাজ অ্যাকাউন্ট-ভিত্তিক/দুই চ্যানেল মিলিয়ে) — limit ৫ থেকে
  // ১৫ করা হয়েছে, নাহলে একটা চ্যানেলের সব সাম্প্রতিক নোটিফিকেশন আরেক চ্যানেলের নিচে চাপা পড়ে যেতে পারত
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, channel")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(15);

  // sidebar এ "অ্যাডমিন" গ্রুপ দেখানো উচিত কিনা জানতে — dashboard/page.tsx এ আগে থেকেই এই
  // একই RPC কল আছে, এখানে নতুন করে যোগ করা হলো যাতে Sidebar এও দেখানো যায়
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  // টপবারে অ্যাভাটারের পাশে দেখানোর জন্য — profile না থাকলে (edge case) ইমেইল দিয়ে fallback
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const workspaceName = (membership.workspaces as unknown as { name: string })?.name ?? "";
  const userName = profile?.full_name || user.email || "";

  return (
    <DashboardShell
      workspaceName={workspaceName}
      userName={userName}
      isSuperAdmin={Boolean(isSuperAdmin)}
      notifications={notifications ?? []}
      logoutAction={logout}
    >
      {children}
    </DashboardShell>
  );
}
