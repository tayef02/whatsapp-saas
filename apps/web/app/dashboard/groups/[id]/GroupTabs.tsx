"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/groups/${groupId}`;

  const tabs = [
    { href: base, label: "সারাংশ" },
    { href: `${base}/keywords`, label: "কিওয়ার্ড রিপ্লাই" },
    { href: `${base}/welcome`, label: "ওয়েলকাম মেসেজ" },
    { href: `${base}/messages`, label: "মেসেজ লগ" },
    { href: `${base}/filters`, label: "ফিল্টার" },
    { href: `${base}/members`, label: "মেম্বার" },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
