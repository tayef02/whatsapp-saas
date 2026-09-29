"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { navGroups, adminNavGroup, isNavItemActive, type NavGroup } from "./nav-config";

// isSuperAdmin=true হলে শুধু তখনই "অ্যাডমিন" গ্রুপ দেখানো হয় (dashboard/layout.tsx এর
// existing is_super_admin RPC কল থেকে পাস হয়ে আসে — নতুন কোনো লজিক না)
export default function Sidebar({
  workspaceName,
  isSuperAdmin,
  mobileOpen,
  onClose,
}: {
  workspaceName: string;
  isSuperAdmin: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const groups: NavGroup[] = isSuperAdmin ? [...navGroups, adminNavGroup] : navGroups;

  return (
    <>
      {/* মোবাইলে সাইডবার খোলা থাকলে ব্যাকগ্রাউন্ড ওভারলে, ট্যাপ করলে বন্ধ হয় */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-border bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* h-16 — টপবারের সাথে উচ্চতা মিলিয়ে রাখা হয়েছে (DashboardShell.tsx এর header ও h-16) */}
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold text-primary">WhatsApp SaaS</p>
            <p className="truncate text-xs text-text-muted">{workspaceName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-1 text-text-muted hover:bg-gray-100 md:hidden" aria-label="মেনু বন্ধ করুন">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-text-muted uppercase">{group.title}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        active ? "bg-primary-light text-primary" : "text-text hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
