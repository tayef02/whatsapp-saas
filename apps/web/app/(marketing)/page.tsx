import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bot, CalendarClock, Check, Inbox, Megaphone, MessageCircle, MessageSquare, MessageSquareReply, ShoppingCart } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import { createClient } from "@/lib/supabase/server";
import FaqAccordion from "./faq/FaqAccordion";
import { ChatCards, CampaignMock, ChipsMock, ConnectMock, HeroMock, InboxMock, KnowledgeMock, OrderMock } from "./_components/Mockups";
import { getLang } from "./_lib/get-lang";
import { fill, getContent } from "./_lib/content";
import { formatNumber, getPlans, lowestPaidPrice } from "./_lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta;
  return { title: { absolute: m.homeTitle }, description: m.homeDescription };
}

const pillarIcons = [Megaphone, Bot, Inbox, ShoppingCart];
const channelIcons = [MessageCircle, MessageSquare, MessageSquareReply, CalendarClock];
const channelTone = ["bg-emerald-100 text-emerald-600", "bg-blue-100 text-blue-600", "bg-zinc-100 text-zinc-500", "bg-zinc-100 text-zinc-500"];

const container = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-10";

export default async function HomePage() {
  const lang = await getLang();
  const t = getContent(lang);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  const { plans } = await getPlans();
  const minPrice = lowestPaidPrice(plans);
  const priceText = minPrice !== null ? formatNumber(minPrice, lang) : null;

  const howMocks = [
    <ConnectMock key="c" m={t.how.mock} sample={t.common.sample} />,
    <KnowledgeMock key="k" m={t.how.mock} sample={t.common.sample} />,
    <CampaignMock key="m" m={t.how.mock} sample={t.common.sample} />,
    <InboxMock key="i" m={t.how.mock} sample={t.common.sample} />,
    <OrderMock key="o" m={t.how.mock} sample={t.common.sample} />,
  ];

  const primaryCta = isLoggedIn ? (
    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700">
      {t.common.dashboard}
      <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700">
      {t.common.startTrial}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );

  return (
    <>
      {/* হিরো */}
      <section className="relative overflow-hidden bg-zinc-50 px-4 pt-16 pb-6 sm:px-6 sm:pt-20 lg:px-10">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="mb-4 text-[13px] font-bold text-purple-600">{t.hero.eyebrow}</div>
            <h1 className="mb-5 text-[34px] leading-[1.12] font-extrabold tracking-tight text-zinc-900 sm:text-[44px] lg:text-[52px]">{t.hero.title}</h1>
            <p className="mb-8 max-w-[540px] text-[15px] leading-relaxed text-zinc-600">{t.hero.body}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {primaryCta}
              <a href="#how-it-works" className="text-sm font-bold text-purple-700 hover:underline">
                {t.hero.secondary} ↓
              </a>
            </div>
            {!isLoggedIn && <p className="mt-3 text-xs text-zinc-500">{t.common.noCard}</p>}
          </div>
          <HeroMock t={t.hero} sample={t.common.sample} />
        </div>
      </section>

      {/* চার স্তম্ভ */}
      <section className="bg-purple-50/50 px-4 py-20 sm:px-6 lg:px-10">
        <div className={container}>
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="mb-3 text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[38px]">{t.pillars.title}</h2>
            <p className="text-sm leading-relaxed text-zinc-600">{t.pillars.body}</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.pillars.items.map((p, i) => {
              const Icon = pillarIcons[i];
              return (
                <div key={p.title}>
                  <Icon className="mb-3 h-6 w-6 text-purple-600" strokeWidth={1.8} />
                  <div className="mb-1.5 text-[15px] font-bold text-zinc-900">{p.title}</div>
                  <p className="text-[13px] leading-relaxed text-zinc-600">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* সমস্যা */}
      <section className="px-4 py-20 sm:px-6 lg:px-10">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-2`}>
          <div>
            <h2 className="mb-4 text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">{t.problem.title}</h2>
            <p className="mb-5 text-sm leading-relaxed text-zinc-600">{t.problem.body}</p>
            <ul className="flex flex-col gap-2.5">
              {t.problem.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-sm text-zinc-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <ChipsMock t={t.problem} />
        </div>
      </section>

      {/* AI রিপ্লাই কার্ড */}
      <section className="overflow-hidden px-4 pb-24 sm:px-6 lg:px-10">
        <div className={`${container} text-center`}>
          <div className="mb-3 text-[11.5px] font-bold tracking-wide text-purple-600 uppercase">{t.aiCards.eyebrow}</div>
          <h2 className="mx-auto mb-4 max-w-2xl text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[38px]">{t.aiCards.title}</h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-zinc-600">{t.aiCards.body}</p>
          <ChatCards t={t.aiCards} sample={t.common.sample} />
        </div>
      </section>

      {/* কেন অটোমেট */}
      <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-10">
        <div className={container}>
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 text-[26px] font-extrabold tracking-tight text-zinc-900 sm:text-[34px]">{t.why.title}</h2>
            <p className="text-sm text-zinc-600">{t.why.body}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {t.why.cards.map((c, i) => (
              <div key={c.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-3 text-lg font-extrabold text-purple-600">{i + 1}</div>
                <div className="mb-3 text-[15px] leading-snug font-bold text-zinc-900">{c.title}</div>
                <ul className="flex flex-col gap-2">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2 text-[13px] text-zinc-600">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" strokeWidth={2.5} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold text-zinc-900">{t.why.closing}</p>
            {primaryCta}
            {!isLoggedIn && <p className="text-xs text-zinc-500">{t.common.noCard}</p>}
          </div>
        </div>
      </section>

      {/* গাঢ় ব্যান্ড */}
      <section className="bg-slate-900 px-4 py-20 sm:px-6 lg:px-10">
        <div className={container}>
          <div className="mb-3 text-[11px] font-bold tracking-wide text-purple-300">{t.band.eyebrow}</div>
          <h2 className="mb-10 max-w-2xl text-[26px] leading-tight font-extrabold tracking-tight text-white sm:text-[34px]">
            {priceText ? fill(t.band.titleWithPrice, { price: priceText }) : t.band.titleNoPrice}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.band.items.map((it) => (
              <div key={it.title} className="border-t border-white/20 pt-4">
                <div className="mb-2 text-[14px] font-bold text-white">{it.title}</div>
                <p className="text-[12.5px] leading-relaxed text-slate-300">{it.desc}</p>
              </div>
            ))}
            {priceText && (
              <div className="border-t border-purple-400 pt-4">
                <div className="text-[11px] font-bold text-purple-300">{t.band.priceLabel}</div>
                <div className="mt-1 flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-extrabold">৳{priceText}</span>
                  <span className="text-xs text-slate-300">{t.band.perMonth}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{t.band.priceNote}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* কীভাবে কাজ করে */}
      <section id="how-it-works" className="scroll-mt-20 px-4 pt-20 sm:px-6 lg:px-10">
        <div className={`${container} mb-12 flex flex-col items-center text-center`}>
          <LogoMark size={44} className="mb-4" />
          <h2 className="mb-3 max-w-2xl text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">{t.how.title}</h2>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600">{t.how.body}</p>
          <Link href="/features" className="mt-3 text-sm font-bold text-purple-700 hover:underline">
            {t.how.link} →
          </Link>
        </div>
        {t.how.rows.map((row, i) => (
          <div key={row.label} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
            <div className={`${container} grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16`}>
              <div>
                <div className="mb-2 text-[11.5px] font-bold text-purple-600">{row.label}</div>
                <h3 className="mb-3 text-[24px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[30px]">{row.title}</h3>
                <p className="mb-3 max-w-md text-sm leading-relaxed text-zinc-600">{row.body}</p>
                <Link href="/features" className="text-[13px] font-bold text-purple-700 hover:underline">
                  {row.link} →
                </Link>
              </div>
              <div className="mx-auto w-full max-w-md">{howMocks[i]}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ২×২ টেক্সট গ্রিড */}
      <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-10">
        <div className={`${container} grid gap-x-12 gap-y-10 sm:grid-cols-2`}>
          {t.grid.map((g) => (
            <div key={g.title}>
              <span className="mb-3 block h-0.5 w-6 bg-purple-500" />
              <div className="mb-2 text-[17px] leading-snug font-extrabold text-zinc-900">{g.title}</div>
              <p className="text-[13.5px] leading-relaxed text-zinc-600">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* চ্যানেল */}
      <section className="px-4 py-20 sm:px-6 lg:px-10">
        <div className={`${container} text-center`}>
          <h2 className="mx-auto mb-3 max-w-2xl text-[26px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[34px]">{t.channels.title}</h2>
          <p className="mb-10 text-sm text-zinc-600">{t.channels.body}</p>
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.channels.items.map((c, i) => {
              const Icon = channelIcons[i];
              const live = c.status === "live";
              return (
                <div key={c.name} className={`relative rounded-2xl p-5 text-left ${live ? "border-[1.5px] border-purple-300 bg-white" : "border border-zinc-200 bg-white/70"}`}>
                  <span className={`absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${live ? "bg-emerald-500" : "bg-zinc-500"}`}>
                    {live ? t.channels.live : t.channels.soon}
                  </span>
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${channelTone[i]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mb-1 text-[14px] font-extrabold text-zinc-900">{c.name}</div>
                  <p className="text-xs leading-relaxed text-zinc-500">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* শুরু করুন + মূল্য কার্ড */}
      <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-10">
        <div className={`${container} grid items-center gap-10 lg:grid-cols-2`}>
          <div>
            <h2 className="mb-3 text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">{t.start.title}</h2>
            <p className="mb-5 max-w-md text-sm leading-relaxed text-zinc-600">{priceText ? fill(t.start.bodyWithPrice, { price: priceText }) : t.start.bodyNoPrice}</p>
            <ul className="flex flex-col gap-2.5">
              {t.start.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-sm text-zinc-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" strokeWidth={2.5} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-2xl border-2 border-purple-500 bg-white p-6 shadow-[0_20px_50px_rgba(147,51,234,0.15)]">
            <div className="mb-1 text-[11px] font-bold text-purple-600">{t.start.cardLabel}</div>
            {priceText && (
              <div className="mb-1 flex items-baseline gap-1.5 text-zinc-900">
                <span className="text-xs text-zinc-500">{t.start.from}</span>
                <span className="text-4xl font-extrabold">৳{priceText}</span>
                <span className="text-xs text-zinc-500">{t.start.perMonth}</span>
              </div>
            )}
            <div className="mb-5 text-xs text-zinc-500">{t.start.cardNote}</div>
            <Link href={isLoggedIn ? "/dashboard" : "/signup"} className="block rounded-lg bg-purple-600 py-3 text-center text-sm font-bold text-white hover:bg-purple-700">
              {isLoggedIn ? t.common.dashboard : t.start.cta}
            </Link>
            <div className="mt-2 text-center text-[11px] text-zinc-400">{t.start.cardFoot}</div>
            <Link href="/pricing" className="mt-3 block text-center text-xs font-bold text-purple-700 hover:underline">
              {t.common.seeAllPlans} →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center text-[26px] font-extrabold tracking-tight text-zinc-900 sm:text-[32px]">{t.faqSection.title}</h2>
          <FaqAccordion items={t.faq.items.slice(0, 6)} />
          <div className="mt-6 text-center">
            <Link href="/faq" className="text-sm font-bold text-purple-700 hover:underline">
              {t.common.seeAllQuestions} →
            </Link>
          </div>
        </div>
      </section>

      {/* শেষ CTA */}
      {!isLoggedIn && (
        <section className="bg-purple-700 px-4 py-20 text-center sm:px-6 lg:px-10">
          <div className="mx-auto mb-4 flex justify-center">
            <LogoMark size={40} className="ring-2 ring-white/30" />
          </div>
          <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t.finalCta.title}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-purple-100">{t.finalCta.body}</p>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3.5 text-sm font-bold text-zinc-900 hover:bg-amber-300">
            {t.start.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-purple-200">{t.common.noCard}</p>
        </section>
      )}
    </>
  );
}
