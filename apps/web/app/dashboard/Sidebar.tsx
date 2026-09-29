"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Users,
  FileText,
  Megaphone,
  Bot,
  Inbox,
  UsersRound,
  CalendarClock,
  ShoppingCart,
  CreditCard,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { title: "ওভারভিউ", items: [{ href: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard }] },
  {
    title: "মেসেজিং",
    items: [
      { href: "/dashboard/numbers", label: "নাম্বার", icon: Smartphone },
      { href: "/dashboard/contacts", label: "কন্টাক্ট", icon: Users },
      { href: "/dashboard/templates", label: "টেমপ্লেট", icon: FileText },
      { href: "/dashboard/campaigns", label: "ক্যাম্পেইন", icon: Megaphone },
    ],
  },
  {
    title: "চ্যাটবট",
    items: [
      { href: "/dashboard/ai-chatbot", label: "AI Chatbot", icon: Bot },
      { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    title: "গ্রুপ",
    items: [
      { href: "/dashboard/groups", label: "গ্রুপ", icon: UsersRound },
      { href: "/dashboard/groups/announcements", label: "অ্যানাউন্সমেন্ট", icon: CalendarClock },
    ],
  },
  { title: "বিক্রি", items: [{ href: "/dashboard/orders", label: "অর্ডার", icon: ShoppingCart }] },
  {
    title: "অ্যাকাউন্ট",
    items: [
      { href: "/dashboard/billing", label: "প্ল্যান ও বিলিং", icon: CreditCard },
      { href: "/dashboard/settings", label: "সেটিংস", icon: Settings },
    ],
  },
];

// isSuperAdmin=true হলে শুধু তখনই "অ্যাডমিন" গ্রুপ দেখানো হয় (dashboard/layout.tsx এর
// existing is_super_admin RPC কল থেকে পাস হয়ে আসে — নতুন কোনো লজিক না)
export default function Sidebar({
  isSuperAdmin,
  mobileOpen,
  onClose,
}: {
  isSuperAdmin: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const groups: NavGroup[] = isSuperAdmin
    ? [...navGroups, { title: "অ্যাডমিন", items: [{ href: "/dashboard/admin/payments", label: "পেমেন্ট রিভিউ", icon: ShieldCheck }] }]
    : navGroups;

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* মোবাইলে সাইডবার খোলা থাকলে ব্যাকগ্রাউন্ড ওভারলে, ট্যাপ করলে বন্ধ হয় */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-border bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-lg font-bold text-primary">WhatsApp SaaS</span>
          <button onClick={onClose} className="rounded-full p-1 text-text-muted hover:bg-gray-100 md:hidden" aria-label="মেনু বন্ধ করুন">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-text-muted uppercase">{group.title}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
