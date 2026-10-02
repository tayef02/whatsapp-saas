# পাবলিক মার্কেটিং ওয়েবসাইট (Gen Z CRM) — `website` ব্রাঞ্চ

## কেন আলাদা ব্রাঞ্চ ও আলাদা ডিজাইন সিস্টেম

`website` ব্রাঞ্চ **`messenger`-এর উপর ভিত্তি করে** বানানো হয়েছে, `main`-এর উপর না — কারণ
`/terms`, `/privacy`, `/data-deletion` পেজ আর forgot/reset-password ফ্লো এখনো শুধু
`messenger` ব্রাঞ্চে আছে, `main`-এ merge হয়নি। মার্কেটিং সাইটের ফুটার এই পেজগুলো লিংক করে,
তাই সেগুলো ছাড়া কাজ অসম্পূর্ণ থাকত। যখন `messenger` ব্রাঞ্চ `main`-এ merge হবে, `website`
ব্রাঞ্চও `main`-এর সাথে rebase/merge করে নেওয়া উচিত।

ড্যাশবোর্ড (`apps/web/app/dashboard/**`) সবুজ রঙের কাস্টম Tailwind `@theme` টোকেন
(`bg-primary` ইত্যাদি, `globals.css`) ব্যবহার করে। মার্কেটিং পেজগুলো (`apps/web/app/(marketing)/**`)
ইচ্ছাকৃতভাবে সেই কাস্টম টোকেন **ব্যবহার করে না** — পরিবর্তে Tailwind-এর stock ডিফল্ট প্যালেট
(`purple-*`, `zinc-*`, `emerald-*`, `blue-*`) ব্যবহার করা হয়েছে। এতে:
- নতুন কোনো CSS ফাইল বা প্যাকেজ লাগেনি (Tailwind v4-এর `@import "tailwindcss";` দিয়ে stock
  প্যালেট এমনিতেই পাওয়া যায়, `@theme`-এ নতুন টোকেন যোগ করলেও পুরনো প্যালেট থেকে যায়)
- ড্যাশবোর্ডের সবুজ আর মার্কেটিং সাইটের বেগুনি/পার্পল কখনো সংঘর্ষ করে না, কারণ ক্লাসনেমই আলাদা
- দুটো আলাদা ব্র্যান্ড-ফিল (ড্যাশবোর্ড = প্রোডাক্টিভিটি টুল, মার্কেটিং সাইট = apaya.com-স্টাইল
  আধুনিক SaaS lander) ইচ্ছাকৃত সিদ্ধান্ত, ভুল না

## রুট গঠন

সব পাবলিক পেজ `apps/web/app/(marketing)/` route group-এ (URL-এ `(marketing)` অংশ দেখা যায় না)।
`layout.tsx` এই group-এর জন্য `<Header>`/`<Footer>` র‍্যাপ করে, আলাদা metadata (title template,
OG) সেট করে।

| রুট | ফাইল | বিবরণ |
|---|---|---|
| `/` | `(marketing)/page.tsx` | হোম — হিরো, ট্রাস্ট সেকশন, ফিচার গ্রিড, চ্যানেল, মূল্য টিজার, FAQ প্রিভিউ, CTA |
| `/features` | `(marketing)/features/page.tsx` | ৪ ক্যাটাগরিতে সব কাজ-করা ফিচার + "শীঘ্রই আসছে" তালিকা |
| `/pricing` | `(marketing)/pricing/page.tsx` | `plans` টেবিল থেকে লাইভ ডেটা (নিচে দেখুন) |
| `/about` | `(marketing)/about/page.tsx` | মিশন + ৪টা মূল্যবোধ, নকল টিম/ইতিহাস নেই |
| `/contact` | `(marketing)/contact/page.tsx` | সত্যি `wa.me`/`mailto` লিংক, নকল ফর্ম নেই |
| `/faq` | `(marketing)/faq/page.tsx` + `FaqAccordion.tsx` | ৯টা প্রশ্ন, client-side accordion |
| `/sitemap.xml` | `app/sitemap.ts` | native Next.js `MetadataRoute.Sitemap` |
| `/robots.txt` | `app/robots.ts` | native Next.js `MetadataRoute.Robots` |

`/terms`, `/privacy`, `/data-deletion` আগে থেকেই আছে (`(legal)` route group, `messenger`
ব্রাঞ্চে যোগ হয়েছিল) — ফুটার শুধু লিংক করে, নতুন কিছু বানানো হয়নি।

## `plans` টেবিল থেকে পাবলিক রিড — কেন `createAdminClient()`

`supabase/migrations/0012_plans_payments_schema.sql`-এ `plans` টেবিলের GRANT শুধু
`authenticated` রোলকে দেওয়া (`anon`-কে না) — ইচ্ছাকৃত, কারণ স্বাভাবিকভাবে এই টেবিল শুধু
লগইন-করা ড্যাশবোর্ড থেকে পড়ার কথা। কিন্তু পাবলিক `/pricing` পেজে লগইন ছাড়াই মূল্য দেখাতে হয়।

নতুন GRANT migration না লিখে (যেটা RLS surface বাড়াত), `pricing/page.tsx` সার্ভার-সাইডে
`createAdminClient()` (service_role, RLS bypass) দিয়ে পড়ে — ডেটা ব্রাউজারে কখনো raw পৌঁছায়
না, শুধু রেন্ডার-করা HTML হিসেবে যায়, যেটা এমনিতেও পাবলিক পেজের উদ্দেশ্য। কোয়েরি ব্যর্থ হলে
(নেটওয়ার্ক/DB সমস্যা) `console.error` লগ করে একটা হার্ডকোডেড fallback অ্যারে দেখানো হয়
(ইউজারের দেওয়া আসল মান — ট্রায়াল/স্টার্টার/প্রো/বিজনেস) — পেজ কখনো ভাঙে না।

## `/` রুটের আচরণ বদল

আগে `app/page.tsx` সবসময় রিডাইরেক্ট করত (unauth→`/login`, workspace নেই→`/onboarding`,
আছে→`/dashboard`)। এখন `/` ডিলিট হয়ে `(marketing)/page.tsx` (হোম পেজ) হয়েছে — লগইন করা
ইউজার গেলে অটো-রিডাইরেক্ট না করে "ড্যাশবোর্ডে যান" বাটন দেখায়।

Workspace-না-থাকলে `/onboarding`-এ পাঠানোর লজিক হারায়নি — `dashboard/layout.tsx` আগে থেকেই
স্বাধীনভাবে একই চেক করে, তাই `/`-এর নিজের কপিটা অপ্রয়োজনীয় ডুপ্লিকেশন ছিল। `login/page.tsx`-এর
পোস্ট-লগইন রিডাইরেক্ট `router.push("/")` থেকে `router.push("/dashboard")`-এ সরাসরি বদলানো
হয়েছে (এটাই একমাত্র জায়গা যেটা `/`-এর পুরনো অটো-রিডাইরেক্টের উপর নির্ভর করত)।

`middleware.ts`-এর `publicPaths` অ্যারেতে `"/"` যোগ করা যায়নি (সব পাথ `/` দিয়ে শুরু হয় বলে
`.startsWith()` পুরো অ্যাপ পাবলিক করে দিত) — তাই `isPublicRoute` আলাদাভাবে
`pathname === "/" || publicPaths.some(p => pathname.startsWith(p))` হিসেবে গণনা হয়।

**বাগ ফিক্স (এই কাজের সময় ধরা পড়েছে)**: middleware-এর `matcher` এ `sitemap.xml`/`robots.txt`
বাদ দেওয়া ছিল না, ফলে ক্রলার/ব্রাউজার `/sitemap.xml` ভিজিট করলে unauth হিসেবে `/login`-এ
রিডাইরেক্ট হয়ে যাচ্ছিল। `matcher` রেজেক্সে `sitemap.xml|robots.txt` বাদ (exclude) করে ঠিক
করা হয়েছে।

## env ভ্যারিয়েবল

- `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_EMAIL` — সাইডবার + `/contact` + ফুটারে।
  খালি থাকলে সংশ্লিষ্ট লিংক render-ই হয় না (conditional)।
- `APP_PUBLIC_URL` (server-only, `NEXT_PUBLIC_` না) — sitemap.xml/robots.txt-এর base URL
  বানাতে, পাসওয়ার্ড রিসেট লিংকেও ব্যবহার হয়।

**বোনাস বাগ ফিক্স**: `NEXT_PUBLIC_SUPPORT_WHATSAPP` আগে থেকেই `Sidebar.tsx`-এ ব্যবহার হতো,
কিন্তু `apps/web/Dockerfile`-এর `ARG`/`ENV` আর `docker-compose.production.yml`-এর
`build.args`-এ কখনো যোগ করা হয়নি — মানে প্রোডাকশন Docker বিল্ডে এই ভ্যারিয়েবলটা কখনোই কাজ
করত না (শুধু লোকাল dev-এ `.env.local` থেকে কাজ করত বলে ধরা পড়েনি)। এই কাজের সময় দুটো ফাইলেই
যোগ করা হয়েছে, `NEXT_PUBLIC_SUPPORT_EMAIL`-এর সাথে।

## পরের ধাপ (সুযোগ হলে)

- `messenger` ব্রাঞ্চ `main`-এ merge হলে `website` ব্রাঞ্চও rebase করা
- মার্কেটিং পেজে real Open Graph ইমেজ (এখন কোনো `og:image` নেই, টেক্সট-অনলি metadata)
- Lighthouse স্কোর মাপা প্রোডাকশন বিল্ডে (dev মোডে অর্থপূর্ণ না)

## দ্বিভাষিক সাইট (English ডিফল্ট + বাংলা) ও নতুন লোগো

**ভাষা**: মার্কেটিং সাইট এখন ডিফল্টভাবে English, হেডারের `EN | বাং` টগল দিয়ে বাংলা। কুকি
`gz_lang` (ডিফল্ট `en`) সার্ভারে `getLang()` (`(marketing)/_lib/get-lang.ts`) পড়ে, টগল
(`_components/LanguageToggle.tsx`) কুকি সেট করে `router.refresh()` করে — একই URL, তাই সার্চ
ইঞ্জিনে ডুপ্লিকেট পেজ হয় না, `<title>`/description ও (`generateMetadata`) ভাষা অনুযায়ী বদলায়।
সব লেখা `_lib/content.en.ts` ও `_lib/content.bn.ts` এ (একই কাঠামো — `Content` টাইপ `en` থেকে,
তাই কোনো key বাদ পড়লে build এ ধরা পড়ে)। **লেখা বদলালে দুই ফাইলেই বদলাতে হবে।** শুধু
মার্কেটিং সাইট দ্বিভাষিক — লগইন/সাইনআপ, লিগ্যাল পেজ ও ড্যাশবোর্ড এখনো শুধু বাংলা।
প্ল্যানের নাম DB তে বাংলা (ট্রায়াল/স্টার্টার/প্রো/বিজনেস), English এ `_lib/plans.ts` এর
`planDisplayName()` ম্যাপ করে — নতুন প্ল্যান যোগ হলে ম্যাপে না থাকলে DB-র নামই দেখাবে।

**ডিজাইন**: apaya-স্টাইল লম্বা ল্যান্ডিং (হিরো + মকআপ, ৪ স্তম্ভ, সমস্যা, AI রিপ্লাই কার্ড, গাঢ়
ব্যান্ড, "কীভাবে কাজ করে" ৫টা সারি, ২×২ গ্রিড, চ্যানেল, মূল্য কার্ড, FAQ, বেগুনি CTA) আর
ভেতরের পেজে বেগুনি breadcrumb ব্যান্ড। মকআপ সব `_components/Mockups.tsx` এ, HTML/CSS দিয়ে আঁকা,
"Sample" ট্যাগ সহ — নকল পরিসংখ্যান নেই। হোমের "From ৳X/month" `plans` টেবিল থেকে (`getPlans()`
এখন `_lib/plans.ts` এ, মূল্য ও হোম দুই পেজ শেয়ার করে)।

**ফ্রি ট্রায়াল ৭ দিন**: আগে হোম/ফিচার পেজের CTA তে ভুলে "৩ দিন" লেখা ছিল (apaya রেফারেন্স থেকে),
অথচ `plans` টেবিল ও মূল্য/FAQ পেজে ৭ দিন — সব এখন ৭ দিন।

**লোগো**: `components/brand/LogoMark.tsx` — মাঝখানে একটা কন্টাক্ট, ঘিরে তিনটা সংযুক্ত
কন্টাক্ট (CRM নেটওয়ার্ক চিহ্ন), আগের চ্যাট-বাবল আইকনের জায়গায়। মার্কেটিং হেডার/ফুটার,
লগইন/সাইনআপ/পাসওয়ার্ড/onboarding, লিগ্যাল, ড্যাশবোর্ড সাইডবার, আর favicon (`app/icon.svg`) সব
জায়গায় এটাই।

**Messenger**: সাইটে এখনো "শীঘ্রই আসছে" — ড্যাশবোর্ডে কাজ শেষ হলেও Meta App Review পর্যন্ত
`NEXT_PUBLIC_MESSENGER_ENABLED=false`। ফ্ল্যাগ চালু হলে `content.*.ts` এর `channels.items` ও
`nav.messenger` এর স্ট্যাটাস বদলাতে হবে।
