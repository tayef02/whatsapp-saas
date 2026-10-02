import Link from "next/link";
import type { Metadata } from "next";
import { Check, ArrowRight, Gift } from "lucide-react";
import Breadcrumb from "../_components/Breadcrumb";
import { getLang } from "../_lib/get-lang";
import { fill, getContent } from "../_lib/content";
import { formatNumber, getPlans, isPopularPlan, planDisplayName } from "../_lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta.pricing;
  return { title: m.title, description: m.description };
}

export default async function PricingPage() {
  const lang = await getLang();
  const t = getContent(lang);
  const p = t.pricing;
  const n = (v: number) => formatNumber(v, lang);

  const { plans } = await getPlans();
  const trial = plans.find((pl) => pl.is_trial);
  const paidPlans = plans.filter((pl) => !pl.is_trial);

  return (
    <>
      <Breadcrumb homeLabel={t.common.home} current={p.eyebrow} />
      <section className="bg-zinc-50 px-4 pt-14 pb-10 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">{p.eyebrow}</div>
        <h1 className="mx-auto mb-3.5 max-w-lg text-[30px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[40px]">{p.title}</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-600">{p.body}</p>
      </section>

      {trial && (
        <section className="mx-auto max-w-3xl px-4 pt-8 pb-2 sm:px-6 lg:px-10">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Gift className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold text-zinc-900">{fill(p.trialTitle, { days: n(trial.duration_days) })}</div>
              <div className="mt-1 text-xs text-zinc-600">
                {fill(p.trialBody, { messages: n(trial.monthly_message_limit), contacts: n(trial.contact_limit), numbers: n(trial.max_numbers) })}
              </div>
            </div>
            <Link href="/signup" className="shrink-0 rounded-lg bg-emerald-600 px-5 py-3 text-[13px] font-bold text-white hover:bg-emerald-700">
              {p.trialCta}
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-10">
        {paidPlans.map((pl) => {
          const popular = isPopularPlan(pl.name);
          return (
            <div key={pl.id} className={`relative rounded-2xl p-7 ${popular ? "border-[1.5px] border-purple-600 bg-[#1e1033] text-white" : "border border-zinc-100 bg-white"}`}>
              {popular && <span className="absolute -top-3 left-6 rounded-full bg-purple-600 px-3 py-1 text-[10.5px] font-bold text-white">{p.popular}</span>}
              <div className={`mb-2.5 text-[15px] font-bold ${popular ? "text-white" : "text-zinc-900"}`}>{planDisplayName(pl.name, lang)}</div>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className={`text-3xl font-extrabold ${popular ? "text-white" : "text-zinc-900"}`}>৳{n(pl.price_bdt)}</span>
                <span className={`text-xs ${popular ? "text-purple-200" : "text-zinc-400"}`}>{p.perMonth}</span>
              </div>
              <div className={`mb-6 text-xs ${popular ? "text-purple-200" : "text-zinc-400"}`}>{fill(p.validity, { days: n(pl.duration_days) })}</div>
              <Link
                href="/signup"
                className={`mb-6 block rounded-lg py-2.5 text-center text-[13px] font-bold ${popular ? "bg-purple-600 text-white hover:bg-purple-500" : "bg-purple-50 text-purple-700 hover:bg-purple-100"}`}
              >
                {p.choose}
              </Link>
              <div className={`mb-4 h-px ${popular ? "bg-white/10" : "bg-zinc-100"}`} />
              <div className="flex flex-col gap-2.5">
                {p.perks.map((perk) => (
                  <div key={perk} className={`flex items-center gap-2 text-xs ${popular ? "text-purple-100" : "text-zinc-600"}`}>
                    <Check className={`h-3.5 w-3.5 shrink-0 ${popular ? "text-purple-300" : "text-purple-600"}`} strokeWidth={2.5} />
                    {fill(perk, { messages: n(pl.monthly_message_limit), contacts: n(pl.contact_limit), numbers: n(pl.max_numbers) })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6 lg:px-10">
        <div className="flex items-start gap-4 rounded-2xl bg-purple-50/40 p-7">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">৳</div>
          <div>
            <div className="mb-1.5 text-[13.5px] font-bold text-zinc-900">{p.howToPayTitle}</div>
            <p className="text-xs leading-relaxed text-zinc-500">{p.howToPay}</p>
          </div>
        </div>
      </section>

      <section className="bg-purple-700 px-4 py-16 text-center sm:px-6 lg:px-10">
        <h2 className="mb-5 text-xl font-extrabold text-white sm:text-2xl">{p.ctaTitle}</h2>
        <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-[13.5px] font-bold text-zinc-900 hover:bg-amber-300">
          {p.ctaButton}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
