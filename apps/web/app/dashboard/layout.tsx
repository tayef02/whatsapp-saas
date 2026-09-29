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

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(5);

  // sidebar এ "অ্যাডমিন" গ্রুপ দেখানো উচিত কিনা জানতে — dashboard/page.tsx এ আগে থেকেই এই
  // একই RPC কল আছে, এখানে নতুন করে যোগ করা হলো যাতে Sidebar এও দেখানো যায়
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  const workspaceName = (membership.workspaces as unknown as { name: string })?.name ?? "";

  return (
    <DashboardShell
      workspaceName={workspaceName}
      isSuperAdmin={Boolean(isSuperAdmin)}
      notifications={notifications ?? []}
      logoutAction={logout}
    >
      {children}
    </DashboardShell>
  );
}
