"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { ToastProvider } from "@/components/ui";

type Notification = { id: string; title: string; body: string | null };

// dashboard/layout.tsx (সার্ভার কম্পোনেন্ট) থেকে সব ডাটা props হিসেবে আসে — এই ফাইলে কোনো
// নতুন ডাটা কোয়েরি নেই, শুধু sidebar/topbar এর লেআউট আর মোবাইল টগল state
export default function DashboardShell({
  workspaceName,
  isSuperAdmin,
  notifications,
  logoutAction,
  children,
}: {
  workspaceName: string;
  isSuperAdmin: boolean;
  notifications: Notification[];
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-app-bg">
        <Sidebar isSuperAdmin={isSuperAdmin} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-gray-100 md:hidden"
                aria-label="মেনু খুলুন"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-semibold text-text">{workspaceName}</span>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell notifications={notifications} />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">লগআউট</span>
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
