"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { getPageTitle } from "./nav-config";
import { ToastProvider } from "@/components/ui";

type Notification = { id: string; title: string; body: string | null };

// dashboard/layout.tsx (সার্ভার কম্পোনেন্ট) থেকে সব ডাটা props হিসেবে আসে — এই ফাইলে কোনো
// নতুন ডাটা কোয়েরি নেই, শুধু sidebar/topbar এর লেআউট আর মোবাইল টগল state
export default function DashboardShell({
  workspaceName,
  userName,
  isSuperAdmin,
  notifications,
  logoutAction,
  children,
}: {
  workspaceName: string;
  userName: string;
  isSuperAdmin: boolean;
  notifications: Notification[];
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, isSuperAdmin);
  const avatarInitial = (userName || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-app-bg">
        <Sidebar workspaceName={workspaceName} isSuperAdmin={isSuperAdmin} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* h-16 — Sidebar.tsx এর লোগো এরিয়ার সাথে উচ্চতা মিলিয়ে রাখা হয়েছে */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-gray-100 md:hidden"
                aria-label="মেনু খুলুন"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="truncate text-base font-semibold text-text md:text-lg">{pageTitle}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell notifications={notifications} />

              <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
                  {avatarInitial}
                </div>
                <span className="hidden text-sm font-medium text-text sm:inline">{userName}</span>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-text-muted hover:bg-gray-100"
                  aria-label="লগআউট"
                  title="লগআউট"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
