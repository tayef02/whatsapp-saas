import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import NotificationBanner from "./NotificationBanner";

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

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          background: "white",
          borderBottom: "1px solid #eee",
        }}
      >
        <strong>{(membership.workspaces as unknown as { name: string })?.name}</strong>
        <form action={logout}>
          <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}>
            লগআউট
          </button>
        </form>
      </header>
      <NotificationBanner notifications={notifications ?? []} />
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
