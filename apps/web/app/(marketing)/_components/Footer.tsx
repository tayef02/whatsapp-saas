import Link from "next/link";
import LogoMark from "@/components/brand/LogoMark";
import type { Content } from "../_lib/content";

// সাপোর্ট WhatsApp/ইমেইল — .env.example দেখুন, build-time এ Dockerfile/docker-compose এর
// মাধ্যমে বসে (NEXT_PUBLIC_* ভ্যারিয়েবল ক্লায়েন্ট বান্ডেলেও যায়, কিন্তু এই ফাইল Server
// Component বলে এখানে সরাসরি process.env পড়া নিরাপদ ও স্বাভাবিক)
const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

const linkClass = "text-xs text-[#a89bb8] hover:text-white";

export default function Footer({ t }: { t: Content["footer"] }) {
  return (
    <footer className="bg-[#0f0a19] px-4 pt-14 pb-9 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 border-b border-white/10 pb-9 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-[15px] font-extrabold text-white">Gen Z CRM</span>
          </div>
          <p className="max-w-[240px] text-xs leading-relaxed text-[#8b7a9e]">{t.tagline}</p>
          <p className="mt-2 text-xs leading-relaxed text-[#8b7a9e]">{t.product}</p>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">{t.productHeading}</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/features" className={linkClass}>{t.features}</Link>
            <Link href="/pricing" className={linkClass}>{t.pricing}</Link>
            <Link href="/faq" className={linkClass}>{t.faq}</Link>
          </div>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">{t.companyHeading}</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/about" className={linkClass}>{t.about}</Link>
            <Link href="/contact" className={linkClass}>{t.contact}</Link>
            {supportWhatsApp && (
              <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {t.whatsappSupport}
              </a>
            )}
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className={linkClass}>
                {supportEmail}
              </a>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">{t.legalHeading}</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/terms" className={linkClass}>{t.terms}</Link>
            <Link href="/privacy" className={linkClass}>{t.privacy}</Link>
            <Link href="/data-deletion" className={linkClass}>{t.dataDeletion}</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 max-w-7xl text-center text-[11.5px] text-[#6b5d7c]">
        © {new Date().getFullYear()} {t.copyright}
      </div>
    </footer>
  );
}
