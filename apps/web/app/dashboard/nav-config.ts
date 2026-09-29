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
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: React.ElementType };
export type NavGroup = { title: string; items: NavItem[] };

// Sidebar আর টপবারের "বর্তমান পেজের নাম" — দুটোই এই একই তালিকা থেকে আসে, যাতে লেবেল
// একবারই লেখা লাগে আর কোথাও অসামঞ্জস্য না হয়
export const navGroups: NavGroup[] = [
  { title: "ওভারভিউ", items: [{ href: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard }] },
  {
    title: "মেসেজিং",
    items: [
      { href: "/dashboard/numbers", label: "WhatsApp নাম্বার", icon: Smartphone },
      { href: "/dashboard/contacts", label: "কন্টাক্ট", icon: Users },
      { href: "/dashboard/templates", label: "টেমপ্লেট", icon: FileText },
      { href: "/dashboard/campaigns", label: "ক্যাম্পেইন", icon: Megaphone },
    ],
  },
  {
    title: "চ্যাটবট",
    items: [
      { href: "/dashboard/ai-chatbot", label: "এআই চ্যাটবট", icon: Bot },
      { href: "/dashboard/inbox", label: "ইনবক্স", icon: Inbox },
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

export const adminNavGroup: NavGroup = {
  title: "অ্যাডমিন",
  items: [{ href: "/dashboard/admin/payments", label: "পেমেন্ট রিভিউ", icon: ShieldCheck }],
};

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// টপবারে বর্তমান পেজের নাম দেখানোর জন্য — সবচেয়ে লম্বা (specific) ম্যাচিং href বেছে নেয়,
// যেমন /dashboard/numbers/new এ থাকলেও "WhatsApp নাম্বার" ই দেখাবে
export function getPageTitle(pathname: string, isSuperAdmin: boolean): string {
  const groups = isSuperAdmin ? [...navGroups, adminNavGroup] : navGroups;
  let best: NavItem | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    if (isNavItemActive(pathname, item.href) && (!best || item.href.length > best.href.length)) {
      best = item;
    }
  }
  return best?.label ?? "ড্যাশবোর্ড";
}
