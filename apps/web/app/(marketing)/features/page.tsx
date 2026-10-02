import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import Breadcrumb from "../_components/Breadcrumb";
import { getLang } from "../_lib/get-lang";
import { getContent } from "../_lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta.features;
  return { title: m.title, description: m.description };
}

export default async function FeaturesPage() {
  const t = getContent(await getLang());
  const f = t.features;

  return (
    <>
      <Breadcrumb homeLabel={t.common.home} current={f.eyebrow} />
      <section className="bg-zinc-50 px-4 py-16 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">{f.eyebrow}</div>
        <h1 className="mx-auto mb-3.5 max-w-2xl text-[30px] leading-tight font-extrabold tracking-tight text-zinc-900 sm:text-[40px]">{f.title}</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-600">{f.body}</p>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-14 px-4 py-16 sm:px-6 lg:px-10">
        {f.categories.map((cat) => (
          <div key={cat.title}>
            <div className="mb-5 text-lg font-extrabold text-zinc-900">{cat.title}</div>
            <div className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-100">
              {cat.items.map((it) => (
                <div key={it.title} className="flex gap-3 p-5 hover:bg-purple-50/40">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" strokeWidth={2.5} />
                  <div>
                    <div className="text-[13.5px] font-bold text-zinc-900">{it.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-7">
          <div className="mb-2.5 text-[13.5px] font-extrabold text-zinc-900">{f.soonTitle}</div>
          <div className="flex flex-wrap gap-2">
            {f.soon.map((c) => (
              <span key={c} className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-purple-700 px-4 py-16 text-center sm:px-6 lg:px-10">
        <h2 className="mb-5 text-xl font-extrabold text-white sm:text-2xl">{f.ctaTitle}</h2>
        <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-[13.5px] font-bold text-zinc-900 hover:bg-amber-300">
          {t.common.startTrialShort}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
