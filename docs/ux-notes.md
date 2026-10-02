# ড্যাশবোর্ড UX উন্নতি — পেজিনেশন, লোডিং/এরর স্টেট, AI চ্যাটবট রিস্ট্রাকচার, মোবাইল

এই নোট ৪টা UX উন্নতির কী বদলেছে আর কেন — পরের কাজে রেফারেন্স হিসেবে। সব পরিবর্তন শুধু
চেহারা/আচরণ, কোনো server action/কোয়েরি সিগনেচার/schema বদলায়নি।

## ১) Pagination কম্পোনেন্ট

`apps/web/components/ui/Pagination.tsx` — নতুন, `components/ui` থেকে export করা।

**দুটো মোড**, props দিয়ে বাছা হয়:
- `hrefTemplate` (string, `"{page}"` প্লেসহোল্ডার সহ) — সার্ভার-সাইড পেজিনেশনের জন্য, `<Link>`
  রেন্ডার করে। ব্যবহার: `/dashboard/campaigns?page={page}`।
- `onPageChange` (function) — ক্লায়েন্ট-সাইড state-এর জন্য, `<button>` রেন্ডার করে।

**গুরুত্বপূর্ণ কারণ `hrefTemplate` একটা স্ট্রিং, ফাংশন না**: `Pagination` কম্পোনেন্ট `"use
client"`। Next.js App Router-এ সার্ভার কম্পোনেন্ট থেকে ক্লায়েন্ট কম্পোনেন্টে সরাসরি ফাংশন prop
পাঠানো যায় না ("Functions cannot be passed directly to Client Components") — এটা একটা
**রানটাইম এরর, `next build`/টাইপ-চেকে ধরা পড়ে না**, শুধু ব্রাউজারে আসল রিকোয়েস্টে ধরা পড়ে।
প্রথম ভার্সনে `href: (page: number) => string` ফাংশন prop ছিল, যেটা সার্ভার কম্পোনেন্ট
(campaigns/contacts/templates/groups-messages পেজ) থেকে ব্যবহার করতে গিয়ে প্রতিটাতে ক্র্যাশ
করেছিল — ব্রাউজারে সরাসরি টেস্ট করেই ধরা পড়ে, `error.tsx` বাউন্ডারি ক্যাচ করেছিল। **শিক্ষা**:
নতুন কোনো client কম্পোনেন্ট সার্ভার কম্পোনেন্ট থেকে prop নেয় এমন জায়গায় ফাংশন prop থাকলে,
শুধু build/typecheck যথেষ্ট না — ব্রাউজারে আসলেই লোড করে দেখা লাগবে।

**কোথায় কোনটা**:
- Server Component পেজ (contacts, campaigns, templates, orders, groups/[id]/messages,
  messenger/comments এর কমেন্ট লগ, messenger/comments/skipped) → `hrefTemplate`, URL এ
  `?page=`।
- ইনবক্স কনভারসেশন লিস্ট (WhatsApp + Messenger) → `onPageChange` (component state) — কারণ
  পুরো লিস্ট `inbox/layout.tsx`-এ একবারে `.limit(100)` ফেচ হয়ে সাইডবারে স্থায়ী থাকে
  (কনভারসেশন সিলেক্ট করলে পুরো লিস্ট আবার ফেচ হয় না), আর ফিল্টার ট্যাবও আগে থেকেই client-side
  ছিল — URL ?page= বসালে সিলেক্টেড conversation id এর সাথে জটিলতা তৈরি করত।
- AI চ্যাটবট নলেজ বেস ডকুমেন্ট তালিকা → `onPageChange` — কারণ `totalReadyWords` (পুরো-টেক্সট
  বনাম chunk-retrieval মোড ঠিক করে) সব ডকুমেন্ট মিলিয়ে হিসাব হয়, তাই সার্ভার কোয়েরি কখনো
  `.range()` দিয়ে কাটা যাবে না — পুরো লিস্ট আগের মতোই আসে, শুধু রেন্ডারিং ক্লায়েন্টে
  পেজিনেটেড।
- ক্যাম্পেইন রিপোর্টের "ব্যর্থ মেসেজ" তালিকা → `onPageChange` — এই তালিকা `/api/campaigns/[id]`
  পোলিং রুট থেকে প্রতি ৩ সেকেন্ডে রিফ্রেশ হয় (সবসময় সর্বশেষ ১০০টা), URL page প্যারাম এখানে
  অর্থহীন হতো।

**`?page=` নাম-সংঘর্ষ সাবধানতা**: Messenger কমেন্ট/স্কিপড-কমেন্ট পেজে `page` query param আগে
থেকেই Facebook পেজ (messenger_pages.id, UUID) বাছতে ব্যবহার হয়। তালিকা-পেজিনেশনের জন্য আলাদা
নাম ব্যবহার হয়েছে: `logPage` (comments) আর `skipPage` (skipped)।

## ২) সার্ভার-সাইড পেজিনেশন যোগ হয়েছে যেখানে

| পেজ | PAGE_SIZE | আগে |
|---|---|---|
| `orders/page.tsx` + `messenger/orders/page.tsx` | ২০ | `.limit(200)`, সার্চ/স্ট্যাটাস ফিল্টার ক্লায়েন্ট-সাইড ছিল |
| `campaigns/page.tsx` | ২০ | কোনো limit/range ছিল না |
| `templates/page.tsx` | ২০ | কোনো limit/range ছিল না |
| `messenger/comments/page.tsx` (কমেন্ট লগ) | ২০ | `.limit(50)` ফ্ল্যাট, পুরনো দেখার উপায় ছিল না |
| `messenger/comments/skipped/page.tsx` | ২০ | `.limit(200)` ফ্ল্যাট |
| `contacts/page.tsx`, `groups/[id]/messages/page.tsx` | ৫০ | আগে থেকেই ঠিক ছিল, শুধু নতুন `Pagination` UI বসানো হয়েছে |

**অর্ডার পেজের বড় বদল**: সার্চ/স্ট্যাটাস ফিল্টার আগে `OrdersList.tsx`-এ `useState` +
`.filter()` দিয়ে ২০০টা রো-র মধ্যে ক্লায়েন্টে হতো — পেজিনেশনের সাথে এটা ভুল ফল দিত (যেমন ২০
রো আনার পর ক্লায়েন্টে ফিল্টার করলে পেজ ২-এ কম/ভুল রেজাল্ট দেখাতো)। তাই সার্চ/স্ট্যাটাস এখন
সার্ভার-সাইড (`contacts/page.tsx`-এর মতোই `.ilike()`/`.or()`/`.eq()`), URL এ `?q=&status=&page=`।
সার্চ আগে group_name/messenger_page_name (join করা টেবিল) এও ম্যাচ করত — সার্ভার-সাইড
`.or()` জয়েন করা কলামে কাজ করে না বলে এটা বাদ পড়েছে (contact_phone/delivery_name/
delivery_phone/product_name এ ম্যাচ করে, আর সংখ্যা হলে order_number এও)।

## ৩) loading.tsx / error.tsx

- `apps/web/components/ui/PageSkeleton.tsx` (নতুন) — `variant` prop (`table`/`form`/`cards`/
  `stats`/`detail`) দিয়ে পেজের আকৃতির কাছাকাছি স্কেলিটন দেখায়। `dashboard/` এর নিচে ৪০টা
  route segment-এ (প্রতিটা `page.tsx`-এর পাশে) একটা করে ২-লাইনের `loading.tsx` বসানো হয়েছে,
  উপযুক্ত variant বেছে।
- `apps/web/app/dashboard/error.tsx` (নতুন, একটাই ফাইল) — Next.js এর error boundary
  নিজের নিচের পুরো সাবট্রি (messenger সহ) কভার করে, তাই প্রতিটা পেজে আলাদা `error.tsx` লাগেনি।
  আসল এরর মেসেজ কখনো ইউজারকে দেখানো হয় না (`console.error` এ লগ হয়), শুধু "একটা সমস্যা
  হয়েছে... আবার চেষ্টা করুন" বাটন।
- **Next.js এর একটা সীমাবদ্ধতা যা এখানে প্রাসঙ্গিক**: কোনো সেগমেন্টের `loading.tsx` সেই একই
  সেগমেন্টের `layout.tsx`-কে কভার করে না (শুধু `page.tsx` আর তার নিচেরটুকু) — তাই
  `inbox/layout.tsx`/`messenger/inbox/layout.tsx`-এর নিজস্ব স্লো ফেচ (কনভারসেশন লিস্ট)
  `inbox/loading.tsx` দিয়ে কভার হয় না, বরং অ্যানসেস্টর `dashboard/loading.tsx`-এর generic
  "stats" স্কেলিটন দেখা যায় প্রথমবার ইনবক্সে ঢোকার সময়। সঠিক শেপ-ম্যাচড স্কেলিটন পেতে হলে
  `layout.tsx`-এর ফেচ React `<Suspense>` দিয়ে আলাদা কম্পোনেন্টে সরাতে হতো — সেটা ডেটা-ফেচিং
  গঠন বদলে ফেলত বলে এই ধাপে করা হয়নি।

## ৪) AI চ্যাটবট পেজ রিস্ট্রাকচার (WhatsApp + Messenger)

`AiChatbotSettings.tsx` ও `MessengerAiChatbotSettings.tsx` — লম্বা ভূমিকা এখন ১ লাইন +
"বিস্তারিত" টগল (click করলে বাকি প্যারাগ্রাফ দেখায়)। ৪টা ট্যাব: প্রম্পট / API Key / নলেজ বেস /
সাপোর্ট তথ্য।

**"প্রম্পট" আর "সাপোর্ট তথ্য" একই `<form>`/`handleSaveSettings` এর ভেতরে** — আলাদা ফর্মে ভাগ
করলে আলাদা সাবমিট/server action লাগত (নিয়ম: server action সিগনেচার বদলানো যাবে না)। তাই
দুটো ট্যাবের ফিল্ড একই ফর্মে থেকে যায়, শুধু CSS দিয়ে (`hidden` ক্লাস) একটার সময় অন্যটা
লুকানো থাকে — ইউজারের কাছে আলাদা ট্যাবের মতোই লাগে, কিন্তু একই সেভ বাটনে দুটোই একসাথে সেভ
হয়।

## ৫) নোটিফিকেশন — পেজিনেশন বসানো হয়নি, কারণ

`NotificationBell` ড্রপডাউন সবসময় `is_read=false` + `.limit(15)` — একটা capped, transient
dropdown, কোনো "সব নোটিফিকেশন" আর্কাইভ পেজ নেই। তাই পেজিনেশন বসানোর মতো "বড় হতে থাকা
তালিকা" এখানে নেই। যদি ভবিষ্যতে একটা পূর্ণ নোটিফিকেশন-হিস্ট্রি পেজ বানানো হয় (নতুন স্কোপ),
তখন একই `Pagination` কম্পোনেন্ট রিইউজ করা যাবে।

## ৬) মোবাইল (৩৯০px)

`components/ui/Table.tsx` আগে থেকেই নিজের ভেতরে `overflow-x-auto` wrapper রাখে (সব
টেবিলে স্বয়ংক্রিয়ভাবে প্রযোজ্য) — তাই "টেবিল ছাড়া অনাবশ্যক স্ক্রল নয়" নিয়ম এমনিতেই অধিকাংশ
জায়গায় মানা হয়ে আসছিল। `OrdersList.tsx`-এ একটা বাড়তি (redundant) `overflow-x-auto` wrapper
ছিল, সরানো হয়েছে। ব্রাউজারে ৩৯০px প্রস্থে ড্যাশবোর্ড হোম, ইনবক্স, অর্ডার, ক্যাম্পেইন, গ্রুপ,
নাম্বার, বিলিং, Messenger কমেন্ট/স্কিপড-কমেন্ট পেজ সরাসরি চেক করা হয়েছে — কোনো অনাবশ্যক
হরাইজন্টাল স্ক্রল পাওয়া যায়নি। `Pagination` কম্পোনেন্টের বাটন/লিংক সব `h-10`
(৪০px) — টাচ-টার্গেট নিয়ম মানে।

## পরের ধাপ (সুযোগ হলে)

- `inbox/layout.tsx`/`messenger/inbox/layout.tsx`-এর স্লো ফেচ React `<Suspense>` দিয়ে
  আলাদা করে প্রকৃত ইনবক্স-শেপড স্কেলিটন দেখানো যায়
- সব "search as you type"-কে debounce করে সার্ভার-সাইড সার্চে নেওয়া (এখন ফর্ম-সাবমিট ভিত্তিক)
