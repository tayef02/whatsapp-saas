import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "../_components/Breadcrumb";
import FaqAccordion from "./FaqAccordion";
import { getLang } from "../_lib/get-lang";
import { getContent } from "../_lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta.faq;
  return { title: m.title, description: m.description };
}

export default async function FaqPage() {
  const t = getContent(await getLang());
  const f = t.faq;

  return (
    <>
      <Breadcrumb homeLabel={t.common.home} current={f.eyebrow} />
      <section className="px-4 pt-14 pb-10 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">{f.eyebrow}</div>
        <h1 className="text-[30px] font-extrabold tracking-tight text-zinc-900 sm:text-[38px]">{f.title}</h1>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6 lg:px-10">
        <FaqAccordion items={f.items} />

        <div className="mt-9 rounded-2xl bg-purple-50/40 p-7 text-center">
          <div className="mb-1.5 text-[13.5px] font-bold text-zinc-900">{f.unanswered}</div>
          <Link href="/contact" className="text-sm font-bold text-purple-700 hover:underline">
            {f.contactLink} →
          </Link>
        </div>
      </section>
    </>
  );
}
