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
  MessageSquare,
  MessageCircleReply,
  ShieldAlert,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: React.ElementType };
export type NavGroup = { title: string; items: NavItem[] };
export type Channel = "whatsapp" | "messenger";

// সব চ্যানেলেই সবসময় দেখা যায় — ড্যাশবোর্ড লিংক এক, কনটেন্টের ভেতরেই চ্যানেল-ভিত্তিক ট্যাব থাকবে
const overviewNavGroup: NavGroup = {
  title: "ওভারভিউ",
  items: [{ href: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard }],
};

const whatsappNavGroups: NavGroup[] = [
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
];

// Messenger চ্যানেল — Phase M0, সবগুলো পেজ এখনো "শীঘ্রই" খোলস (পেজ কানেক্ট ছাড়া)।
// অর্ডার পেজ WhatsApp এর সাথে শেয়ার্ড (একই /dashboard/orders রুট, আলাদা পেজ না) —
// channel ফিল্টার M3 এ orders.channel কলাম আসার পর যোগ হবে
const messengerNavGroups: NavGroup[] = [
  {
    title: "Messenger",
    items: [
      { href: "/dashboard/messenger", label: "পেজ কানেক্ট", icon: MessageSquare },
      { href: "/dashboard/messenger/inbox", label: "ইনবক্স", icon: Inbox },
      { href: "/dashboard/messenger/ai-chatbot", label: "এআই চ্যাটবট", icon: Bot },
    ],
  },
  {
    title: "অটোমেশন",
    items: [
      { href: "/dashboard/messenger/comments", label: "কমেন্ট অটোমেশন", icon: MessageCircleReply },
      { href: "/dashboard/messenger/posts", label: "পোস্ট শিডিউলার", icon: CalendarClock },
      { href: "/dashboard/messenger/moderation", label: "মডারেশন", icon: ShieldAlert },
    ],
  },
  { title: "বিক্রি", items: [{ href: "/dashboard/orders", label: "অর্ডার", icon: ShoppingCart }] },
];

const accountNavGroup: NavGroup = {
  title: "অ্যাকাউন্ট",
  items: [
    { href: "/dashboard/billing", label: "প্ল্যান ও বিলিং", icon: CreditCard },
    { href: "/dashboard/settings", label: "সেটিংস", icon: Settings },
  ],
};

export const adminNavGroup: NavGroup = {
  title: "অ্যাডমিন",
  items: [{ href: "/dashboard/admin/payments", label: "পেমেন্ট রিভিউ", icon: ShieldCheck }],
};

// URL ভিত্তিক — /dashboard/messenger/... এ থাকলে Messenger, নাহলে WhatsApp। কোনো আলাদা
// state/context লাগে না, sidebar আর topbar দুটোই pathname থেকে স্বাধীনভাবে বের করতে পারে
export function getChannelFromPathname(pathname: string): Channel {
  return pathname === "/dashboard/messenger" || pathname.startsWith("/dashboard/messenger/") ? "messenger" : "whatsapp";
}

// Sidebar আর টপবারের "বর্তমান পেজের নাম" — দুটোই এই একই ফাংশন থেকে আসে, যাতে লেবেল
// একবারই লেখা লাগে আর কোথাও অসামঞ্জস্য না হয়
export function getNavGroups(channel: Channel, isSuperAdmin: boolean): NavGroup[] {
  const channelGroups = channel === "messenger" ? messengerNavGroups : whatsappNavGroups;
  const groups = [overviewNavGroup, ...channelGroups, accountNavGroup];
  return isSuperAdmin ? [...groups, adminNavGroup] : groups;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// টপবারে বর্তমান পেজের নাম দেখানোর জন্য — সবচেয়ে লম্বা (specific) ম্যাচিং href বেছে নেয়,
// যেমন /dashboard/numbers/new এ থাকলেও "WhatsApp নাম্বার" ই দেখাবে
export function getPageTitle(pathname: string, isSuperAdmin: boolean): string {
  const channel = getChannelFromPathname(pathname);
  const groups = getNavGroups(channel, isSuperAdmin);
  let best: NavItem | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    if (isNavItemActive(pathname, item.href) && (!best || item.href.length > best.href.length)) {
      best = item;
    }
  }
  return best?.label ?? "ড্যাশবোর্ড";
}
