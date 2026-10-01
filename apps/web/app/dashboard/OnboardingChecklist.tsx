import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui";

// pending: true হলে আইটেমটা দেখানো হয় কিন্তু "সব শেষ" হিসাবের বাইরে থাকে — যে ফিচার এখনো
// তৈরিই হয়নি (যেমন Messenger কমেন্ট রুল, Phase ৩ আসার আগ পর্যন্ত) সেটা কখনো "done" হতে
// পারবে না, এই ফ্ল্যাগ ছাড়া কার্ডটা চিরকাল আটকে থাকত (কখনো হাইড হতো না)
export type ChecklistItem = { label: string; done: boolean; href?: string; note?: string; pending?: boolean };

// প্রতিটা চ্যানেল সেকশন নিজের ধাপগুলো (items) দিয়ে এটা কল করে — pending বাদে বাকি সব ধাপ done
// হলে কার্ডটাই হাইড হয়ে যায় (null রিটার্ন), যাতে অভিজ্ঞ ইউজারের ড্যাশবোর্ডে অপ্রয়োজনীয় কার্ড না থাকে
export default function OnboardingChecklist({ title, items }: { title: string; items: ChecklistItem[] }) {
  if (items.filter((item) => !item.pending).every((item) => item.done)) return null;

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-text">{title}</p>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-text-muted" />
              )}
              <span className={`truncate ${item.done ? "text-text-muted line-through" : "text-text"}`}>{item.label}</span>
              {item.note && <span className="shrink-0 text-xs text-text-muted">{item.note}</span>}
            </div>
            {!item.done && item.href && (
              <Link href={item.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
                শুরু করুন
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
