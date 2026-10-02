import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle, Mail, Clock, ArrowRight } from "lucide-react";
import Breadcrumb from "../_components/Breadcrumb";
import { getLang } from "../_lib/get-lang";
import { getContent } from "../_lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const m = getContent(await getLang()).meta.contact;
  return { title: m.title, description: m.description };
}

// সাপোর্ট নাম্বার/ইমেইল — .env.example দেখুন। Server Component বলে সরাসরি process.env
// পড়া নিরাপদ, আর কোনো মান না থাকলে (লোকাল ডেভে সেট করা না থাকলে) সংশ্লিষ্ট কার্ডটাই লুকানো থাকে —
// খালি/ভাঙা লিংক দেখানো হয় না।
const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default async function ContactPage() {
  const t = getContent(await getLang());
  const c = t.contact;

  return (
    <>
      <Breadcrumb homeLabel={t.common.home} current={c.eyebrow} />
      <section className="mx-auto max-w-xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-10">
        <div className="mb-2.5 text-xs font-bold text-purple-600">{c.eyebrow}</div>
        <h1 className="mb-3.5 text-[30px] font-extrabold tracking-tight text-zinc-900 sm:text-[38px]">{c.title}</h1>
        <p className="text-sm text-zinc-600">{c.body}</p>
      </section>

      <section className="mx-auto grid max-w-3xl gap-4 px-4 pb-10 sm:grid-cols-2 sm:px-6 lg:px-10">
        {supportWhatsApp ? (
          <a
            href={`https://wa.me/${supportWhatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-emerald-200 bg-emerald-50 p-7 hover:border-emerald-400"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-zinc-900">{c.whatsappTitle}</div>
              <div className="mt-0.5 text-xs text-zinc-600">{c.whatsappDesc}</div>
            </div>
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-700">
              {c.whatsappCta} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </a>
        ) : null}

        {supportEmail ? (
          <a href={`mailto:${supportEmail}`} className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-100 bg-white p-7 hover:border-purple-300">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-zinc-900">{c.emailTitle}</div>
              <div className="mt-0.5 text-xs break-all text-zinc-600">{supportEmail}</div>
            </div>
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-purple-700">
              {c.emailCta} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </a>
        ) : null}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3 rounded-2xl bg-purple-50/40 p-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-xs text-zinc-600">
            <span className="font-bold text-zinc-900">{c.responseLabel}</span>
            {c.response}
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 px-4 py-14 text-center sm:px-6 lg:px-10">
        <div className="mb-2 text-[13.5px] font-bold text-zinc-900">{c.faqTitle}</div>
        <Link href="/faq" className="text-sm font-bold text-purple-700 hover:underline">
          {c.faqLink} →
        </Link>
      </section>
    </>
  );
}
