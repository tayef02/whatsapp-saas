import { Bot, Check, Clock, FileText, Smartphone } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import type { Content } from "../_lib/content";

// হোম পেজের সব ভিজ্যুয়াল মকআপ — পুরোটাই HTML/CSS দিয়ে আঁকা (কোনো বাইরের ছবি/কপিরাইট নেই)।
// মকআপের লেখা/সংখ্যা সবই উদাহরণ ("Sample" ট্যাগ সহ) — আসল গ্রাহক সংখ্যা বা পরিসংখ্যান দাবি করে না

function SkeletonBar({ w = "w-24", className = "" }: { w?: string; className?: string }) {
  return <span className={`block h-2 rounded-full bg-zinc-200 ${w} ${className}`} />;
}

function Pill({ children, tone = "purple" }: { children: React.ReactNode; tone?: "purple" | "green" | "amber" | "red" | "blue" | "gray" }) {
  const tones = {
    purple: "bg-purple-100 text-purple-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-zinc-100 text-zinc-600",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

function MockShell({ sample, children, className = "" }: { sample: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_rgba(24,24,27,0.10)] ${className}`}>
      <span className="absolute -top-2.5 right-4 rounded-full bg-zinc-800 px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-white uppercase">{sample}</span>
      {children}
    </div>
  );
}

function Bubble({ side, children }: { side: "customer" | "ai"; children: React.ReactNode }) {
  return (
    <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[11.5px] leading-snug ${side === "customer" ? "self-start bg-zinc-100 text-zinc-800" : "self-end bg-purple-100 text-purple-900"}`}>
      {children}
    </div>
  );
}

// ───────── হিরো ─────────
export function HeroMock({ t, sample }: { t: Content["hero"]; sample: string }) {
  const m = t.mock;
  return (
    <div className="relative mx-auto w-full max-w-[540px] pt-9 pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-14 -z-10 h-72 rounded-full bg-gradient-to-r from-purple-400/50 via-fuchsia-300/40 to-sky-300/40 blur-3xl"
      />
      <div className="absolute top-0 left-10 z-10 flex items-center gap-1.5 rounded-full bg-white py-2 pr-3.5 pl-2.5 text-xs font-bold text-zinc-700 shadow-[0_10px_30px_rgba(24,24,27,0.14)]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t.pill}
      </div>

      <div className="relative mt-8 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-[0_30px_70px_rgba(24,24,27,0.16)]">
        <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3.5 py-2.5">
          <span className="h-2 w-2 rounded-full bg-red-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">{sample}</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="text-xs font-bold text-zinc-900">
            {m.title} <span className="font-medium text-zinc-400">· {m.subtitle}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {m.tiles.map((label, i) => (
              <div key={label} className="rounded-lg bg-purple-50 p-2.5 text-center">
                <div className="mx-auto mb-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-purple-200 text-[10px] font-extrabold text-purple-700">{i + 1}</div>
                <div className="text-[9px] font-semibold text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="mb-1.5 flex justify-between text-[10.5px] text-zinc-500">
              <span>{m.campaign}</span>
              <span className="font-bold text-purple-700">{m.running}</span>
            </div>
            <div className="h-1.5 rounded-full bg-purple-100">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-purple-400 to-purple-700" />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3">
            <div className="text-[10.5px] font-bold text-zinc-700">{m.inbox}</div>
            {[true, false].map((needs, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-zinc-200" />
                <SkeletonBar w={i === 0 ? "w-24" : "w-16"} />
                {needs && <span className="ml-auto"><Pill tone="red">{m.needsAgent}</Pill></span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-10 w-[64%] -rotate-2 rounded-2xl border border-zinc-100 bg-white p-3 shadow-[0_20px_50px_rgba(24,24,27,0.18)]">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-purple-700">
          <Bot className="h-3 w-3" /> {m.chatTitle}
        </div>
        <div className="flex flex-col gap-1.5">
          <Bubble side="customer">{m.chatCustomer}</Bubble>
          <Bubble side="ai">{m.chatAi}</Bubble>
        </div>
      </div>
    </div>
  );
}

// ───────── সমস্যা সেকশনের ভাসমান চিপ ─────────
export function ChipsMock({ t }: { t: Content["problem"] }) {
  const rotations = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-3", "rotate-1", "-rotate-2"];
  const borders = ["border-l-purple-500", "border-l-pink-500", "border-l-amber-500", "border-l-sky-500"];
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-3 text-center text-[10.5px] font-bold tracking-wide text-zinc-400 uppercase">{t.chipsLabel}</div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {t.chips.map((chip, i) => (
          <span
            key={chip}
            className={`${rotations[i % rotations.length]} rounded-lg border border-l-4 border-zinc-200 ${borders[i % borders.length]} bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 shadow-sm`}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        <span className="rounded-xl border-2 border-purple-500 bg-white px-4 py-2.5 text-[13px] font-bold text-purple-700 shadow-[0_10px_30px_rgba(147,51,234,0.25)]">{t.highlight}</span>
        <span className="text-[11px] text-zinc-400">“{t.caption}”</span>
      </div>
    </div>
  );
}

// ───────── AI রিপ্লাইয়ের তিনটা কার্ড ─────────
export function ChatCards({ t, sample }: { t: Content["aiCards"]; sample: string }) {
  const tilt = ["lg:-rotate-3 lg:translate-y-4", "lg:z-10", "lg:rotate-3 lg:translate-y-4"];
  return (
    <div className="mx-auto mt-12 grid max-w-4xl gap-6 px-2 lg:grid-cols-3 lg:gap-0 lg:px-0">
      {t.cards.map((c, i) => (
        <MockShell key={c.tag} sample={sample} className={`${tilt[i]} lg:-mx-3`}>
          <div className="mb-3 flex items-center gap-2">
            <LogoMark size={22} />
            <div className="text-[11.5px] font-bold text-zinc-900">{c.tag}</div>
          </div>
          <div className="flex flex-col gap-2">
            <Bubble side="customer">{c.customer}</Bubble>
            <Bubble side="ai">{c.ai}</Bubble>
          </div>
          {c.badge && (
            <div className="mt-3">
              <Pill tone="red">{c.badge}</Pill>
            </div>
          )}
        </MockShell>
      ))}
    </div>
  );
}

// ───────── "কীভাবে কাজ করে" সারির মকআপ ─────────
type HowMock = Content["how"]["mock"];

export function ConnectMock({ m, sample }: { m: HowMock; sample: string }) {
  return (
    <MockShell sample={sample}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-bold text-zinc-900">{m.connectTitle}</div>
          <SkeletonBar w="w-20" className="mt-1.5" />
        </div>
        <Pill tone="green">{m.connected}</Pill>
      </div>
      <div className="mb-3">
        <Pill tone="amber">{m.warmup}</Pill>
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[10.5px] text-zinc-500">{m.dailyLimit}</div>
        <div className="h-1.5 rounded-full bg-zinc-100">
          <div className="h-full w-[18%] rounded-full bg-purple-500" />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2.5">
        <Bot className="h-4 w-4 text-purple-600" />
        <span className="text-[12px] font-bold text-purple-700">{m.botOn}</span>
        <span className="ml-auto text-[10.5px] text-zinc-500">{m.botOnDesc}</span>
      </div>
    </MockShell>
  );
}

export function KnowledgeMock({ m, sample }: { m: HowMock; sample: string }) {
  const files = [
    { name: "price-list.pdf", ready: true },
    { name: "faq.txt", ready: true },
    { name: "catalogue.xlsx", ready: false },
  ];
  return (
    <MockShell sample={sample}>
      <div className="mb-3 text-[12.5px] font-bold text-zinc-900">{m.kbTitle}</div>
      <div className="mb-3 flex flex-col gap-2">
        {files.map((f) => (
          <div key={f.name} className="flex items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2">
            <FileText className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[11.5px] font-medium text-zinc-700">{f.name}</span>
            <span className="ml-auto">{f.ready ? <Pill tone="green">{m.ready}</Pill> : <Pill tone="blue">{m.processing}</Pill>}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-zinc-50 p-3">
        <div className="mb-1 text-[10px] font-bold tracking-wide text-zinc-400 uppercase">{m.promptLabel}</div>
        <div className="text-[11.5px] leading-snug text-zinc-700">{m.prompt}</div>
      </div>
    </MockShell>
  );
}

export function CampaignMock({ m, sample }: { m: HowMock; sample: string }) {
  const stats = [
    { label: m.sent, w: "w-[92%]", dot: "bg-blue-500" },
    { label: m.delivered, w: "w-[78%]", dot: "bg-emerald-500" },
    { label: m.read, w: "w-[52%]", dot: "bg-purple-500" },
    { label: m.failed, w: "w-[6%]", dot: "bg-red-500" },
  ];
  return (
    <MockShell sample={sample}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12.5px] font-bold text-zinc-900">{m.campaignName}</div>
        <SkeletonBar w="w-12" />
      </div>
      <div className="mb-4 h-1.5 rounded-full bg-zinc-100">
        <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-purple-400 to-purple-700" />
      </div>
      <div className="mb-3 flex flex-col gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
            <span className="w-16 shrink-0 text-[11px] text-zinc-600">{s.label}</span>
            <span className="h-1.5 flex-1 rounded-full bg-zinc-100">
              <span className={`block h-full rounded-full ${s.dot} ${s.w}`} />
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
        <Clock className="h-3 w-3" /> {m.delay}
      </div>
    </MockShell>
  );
}

export function InboxMock({ m, sample }: { m: HowMock; sample: string }) {
  return (
    <MockShell sample={sample}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="mr-1 text-[12.5px] font-bold text-zinc-900">{m.inboxTitle}</span>
        <Pill tone="purple">{m.all}</Pill>
        <Pill tone="gray">{m.unanswered}</Pill>
        <Pill tone="gray">{m.agent}</Pill>
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <div className="flex flex-col gap-2 border-r border-zinc-100 pr-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rounded-lg p-2 ${i === 0 ? "bg-purple-50" : ""}`}>
              <div className="text-[10.5px] font-semibold text-zinc-700">{m.customer}</div>
              <SkeletonBar w="w-14" className="mt-1.5" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Bubble side="customer">{m.thread[0]}</Bubble>
          <Bubble side="ai">{m.thread[1]}</Bubble>
        </div>
      </div>
    </MockShell>
  );
}

export function OrderMock({ m, sample }: { m: HowMock; sample: string }) {
  const steps = [m.pending, m.confirmed, m.shipped];
  return (
    <MockShell sample={sample}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[12.5px] font-bold text-zinc-900">{m.orderTitle} #12</div>
        <Pill tone="blue">{m.confirmed}</Pill>
      </div>
      <div className="mb-4 text-[11.5px] text-zinc-500">{m.orderProduct}</div>
      <div className="mb-4 flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${i <= 1 ? "bg-purple-600 text-white" : "bg-zinc-200 text-zinc-400"}`}>
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className={`text-[10px] font-semibold ${i <= 1 ? "text-zinc-800" : "text-zinc-400"}`}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" /> {m.notified}
      </div>
    </MockShell>
  );
}
