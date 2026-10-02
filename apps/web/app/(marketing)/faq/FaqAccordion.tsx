"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = { q: string; a: string };

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q} className="overflow-hidden rounded-xl border border-zinc-100">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-purple-50/40"
              aria-expanded={isOpen}
            >
              <span className="text-[13.5px] font-bold text-zinc-900">{item.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-purple-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && <div className="px-5 pb-4 text-[13px] leading-relaxed text-zinc-500">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
