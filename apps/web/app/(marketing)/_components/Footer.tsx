import Link from "next/link";

// সাপোর্ট WhatsApp/ইমেইল — .env.example দেখুন, build-time এ Dockerfile/docker-compose এর
// মাধ্যমে বসে (NEXT_PUBLIC_* ভ্যারিয়েবল ক্লায়েন্ট বান্ডেলেও যায়, কিন্তু এই ফাইল Server
// Component বলে এখানে সরাসরি process.env পড়া নিরাপদ ও স্বাভাবিক)
const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function Footer() {
  return (
    <footer className="bg-[#0f0a19] px-4 pt-14 pb-9 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 border-b border-white/10 pb-9 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-[7px] bg-gradient-to-br from-purple-400 to-purple-700" />
            <span className="text-[15px] font-extrabold text-white">Gen Z CRM</span>
          </div>
          <p className="max-w-[220px] text-xs leading-relaxed text-[#8b7a9e]">
            বাংলাদেশের ছোট ও মাঝারি ব্যবসার জন্য WhatsApp মার্কেটিং সহজ করতে তৈরি।
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#8b7a9e]">Gen Z IT Zone-এর পণ্য</p>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">প্রোডাক্ট</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/features" className="text-xs text-[#a89bb8] hover:text-white">
              ফিচার
            </Link>
            <Link href="/pricing" className="text-xs text-[#a89bb8] hover:text-white">
              মূল্য
            </Link>
            <Link href="/faq" className="text-xs text-[#a89bb8] hover:text-white">
              প্রশ্নোত্তর
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">কোম্পানি</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/about" className="text-xs text-[#a89bb8] hover:text-white">
              আমাদের সম্পর্কে
            </Link>
            <Link href="/contact" className="text-xs text-[#a89bb8] hover:text-white">
              যোগাযোগ
            </Link>
            {supportWhatsApp && (
              <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#a89bb8] hover:text-white">
                WhatsApp সাপোর্ট
              </a>
            )}
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="text-xs text-[#a89bb8] hover:text-white">
                {supportEmail}
              </a>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3.5 text-[11.5px] font-bold text-white">আইনি</div>
          <div className="flex flex-col gap-2.5">
            <Link href="/terms" className="text-xs text-[#a89bb8] hover:text-white">
              শর্তাবলী
            </Link>
            <Link href="/privacy" className="text-xs text-[#a89bb8] hover:text-white">
              গোপনীয়তা নীতি
            </Link>
            <Link href="/data-deletion" className="text-xs text-[#a89bb8] hover:text-white">
              ডাটা ডিলিশন
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 max-w-7xl text-center text-[11.5px] text-[#6b5d7c]">
        © {new Date().getFullYear()} Gen Z CRM · Gen Z IT Zone · বাংলাদেশ
      </div>
    </footer>
  );
}
