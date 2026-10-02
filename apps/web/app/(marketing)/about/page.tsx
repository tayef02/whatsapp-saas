import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Heart, MapPin, Shield, Sparkles } from "lucide-react";
import Breadcrumb from "../_components/Breadcrumb";
import { getLang } from "../_lib/get-lang";
import { getContent } from "../_lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta.about;
  return { title: m.title, description: m.description };
}

const valueIcons = [Heart, MapPin, Shield, Sparkles];

export default async function AboutPage() {
  const t = getContent(await getLang());
  const a = t.about;

  return (
    <>
      <Breadcrumb homeLabel={t.common.home} current={a.eyebrow} />
      <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">{a.eyebrow}</div>
        <h1 className="mb-6 text-[28px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[36px]">{a.title}</h1>
        <p className="text-[14.5px] leading-[1.9] text-zinc-600">
          {a.p1}
          <br />
          <br />
          {a.p2} <strong className="font-bold text-zinc-900">{a.brand}</strong>.
        </p>
      </section>

      <section className="bg-zinc-50 px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-3xl gap-[18px] sm:grid-cols-2">
          {a.values.map((v, i) => {
            const Icon = valueIcons[i];
            return (
              <div key={v.title} className="rounded-2xl border border-zinc-100 bg-white p-6">
                <div className="mb-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mb-1.5 text-[14px] font-bold text-zinc-900">{v.title}</div>
                <div className="text-xs leading-relaxed text-zinc-500">{v.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-purple-700 px-4 py-20 text-center sm:px-6 lg:px-10">
        <h2 className="mx-auto mb-5 max-w-md text-xl font-extrabold text-white sm:text-2xl">{a.ctaTitle}</h2>
        <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-[13.5px] font-bold text-zinc-900 hover:bg-amber-300">
          {t.common.startTrialShort}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
