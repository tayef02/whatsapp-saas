# WhatsApp Marketing SaaS (বাংলাদেশ মার্কেট)

এই ফাইলটা প্রতি সেশনে প্রজেক্টের কনটেক্সট মনে রাখার জন্য। যেকোনো কোড লেখার আগে এই নিয়মগুলো মেনে চলতে হবে।

## ইউজার প্রোফাইল
- ইউজার n8n-এ দক্ষ, কোডিংয়ে নতুন। প্রতিটা ধাপে কী করা হচ্ছে সংক্ষেপে বাংলায় বুঝিয়ে দিতে হবে।
- কোড স্টাইল: সহজ নাম, সহজ কমেন্ট।
- Secrets সবসময় `.env` ফাইলে, কোডে কখনো হার্ডকোড না। Supabase key ইউজার নিজে `.env.local`-এ বসাবে — শুধু `.env.example` বানিয়ে দেখাতে হবে কোন কোন key লাগবে।

## Stack
- **Frontend/API**: Next.js (App Router), stateless — যাতে পরে লোড ব্যালান্সারের পেছনে একাধিক কপি চালানো যায়
- **DB/Auth**: Supabase (Postgres + Auth + RLS), multi-tenant (workspace ভিত্তিক)
- **WhatsApp engine**: Evolution API (self-hosted)
- **Queue**: Redis + BullMQ
- **Worker**: Node.js, আলাদা সার্ভারে চালানো যায় এমনভাবে, একাধিক worker সমান্তরালে চলতে পারবে (একই queue, ডুপ্লিকেট মেসেজ যাবে না)
- **Infra**: Docker, Docker Compose, Nginx + SSL

## আর্কিটেকচার নিয়ম (সবসময় মানতে হবে)

1. **সব মেসেজ queue দিয়ে যাবে** — কখনো Next.js থেকে সরাসরি Evolution API কল না। Campaign/message create হলে BullMQ job বসবে, worker সেটা প্রসেস করবে।
2. **evolution_servers টেবিল** — কোন WhatsApp নাম্বার কোন Evolution সার্ভারে হোস্ট হচ্ছে তার ম্যাপিং। নতুন নাম্বার সবচেয়ে কম-লোড সার্ভারে অ্যাসাইন হবে (capacity/active_numbers count দেখে)। নতুন সার্ভার যোগ করতে কোড বদলানো লাগবে না — শুধু এই টেবিলে একটা row অ্যাড করলেই হবে।
3. **Rate limiting**: প্রতি WhatsApp নাম্বারে আলাদা rate limit (per-number sending limiter), প্রতি ইউজারে প্ল্যানভিত্তিক দৈনিক মেসেজ লিমিট — যাতে এক ইউজার পুরো সিস্টেম (queue/worker/Evolution সার্ভার) দখল করতে না পারে।
4. **ওয়েবহুক হ্যান্ডলার** (delivery/read status, reply, QR event, connection event) — শুধু raw event queue-তে push করবে এবং সাথে সাথে `200 OK` রিটার্ন দেবে। ভারী প্রসেসিং (DB আপডেট, নোটিফিকেশন) worker করবে।
5. **Provider abstraction** — একটা common interface (`WhatsAppProvider`) থাকবে যেটা Evolution API আর Meta Cloud API দুটোই ইমপ্লিমেন্ট করবে (send message, get status, connect number ইত্যাদি মেথড)। এখন শুধু Evolution ইমপ্লিমেন্ট হবে, Meta পরে (ফেজ ৩) যোগ হবে কিন্তু ইন্টারফেস এখনই রেডি রাখতে হবে।
6. **নাম্বার প্রতি provider ফিল্ড** — `whatsapp_numbers` টেবিলে `provider` কলাম (`evolution` | `meta`) থাকবে, যাতে ভারী ইউজারকে পরে শুধু এই ফিল্ড বদলে Meta Cloud API-তে সরানো যায়, কোড বদলানো ছাড়াই।
7. **ডাটাবেস পারফরম্যান্স**:
   - Supabase connection pooler ব্যবহার (transaction mode)
   - দরকারি জায়গায় index (workspace_id, phone_number, status, created_at ইত্যাদি কম্পোজিট index)
   - মেসেজ স্ট্যাটাস আপডেট ব্যাচে লেখা হবে (worker একটার পর একটা না লিখে বাল্ক আপডেট করবে)
   - ৯০ দিনের পুরনো লগ আর্কাইভ করার স্ক্রিপ্ট (cron/scheduled script)
8. **messages টেবিল মাসভিত্তিক partition** (PostgreSQL native partitioning, `messages_YYYY_MM`), আর ক্যাম্পেইনের sent/delivered/read/failed কাউন্ট আলাদা `campaign_stats` summary টেবিলে রাখা হবে যাতে প্রতিবার count(*) করতে না হয় — worker ব্যাচে increment করবে।
9. **RLS/GRANT বাধ্যতামূলক** — Supabase প্রজেক্টে "Automatically expose new tables" বন্ধ আর "automatic RLS" চালু আছে। তাই **প্রতিটা migration-এ প্রতিটা নতুন টেবিলের জন্য স্পষ্ট `GRANT` স্টেটমেন্ট আর RLS policy লিখতে হবে**, যাতে প্রতি workspace শুধু নিজের ডাটা দেখতে পায়। কোনো টেবিল RLS policy ছাড়া রেখে দেওয়া চলবে না। **`bigserial`/`serial` কলাম যোগ করলে সেই কলামের নিজস্ব sequence-এও আলাদা `GRANT USAGE, SELECT` লাগে** — টেবিলের GRANT সেটা কভার করে না (একবার এই ভুলে লাইভে `permission denied for sequence` এরর হয়েছিল, দেখো migration 0024)।
10. **WhatsApp সেশন ডাটা** persistent volume-এ রাখা (Docker volume), সার্ভার রিস্টার্টে যেন সেশন না হারায়।
11. Worker আর Evolution API আলাদা সার্ভারে ডিপ্লয় করা যায় এমনভাবে কনফিগারেবল (env ভিত্তিক host/port)।

## সেফটি নিয়ম (নাম্বার ব্যান ঠেকাতে — সব ফেজে বাধ্যতামূলক)
- প্রতি নাম্বারে দৈনিক পাঠানোর সর্বোচ্চ সীমা
- ওয়ার্ম-আপ মোড: নতুন কানেক্ট করা নাম্বারে প্রথম কয়েকদিন কম লিমিট, ধীরে ধীরে বাড়বে
- মেসেজের মাঝে ন্যূনতম ডিলে বাধ্যতামূলক + র‍্যান্ডম ডিলে (খুব দ্রুত পাঠানো ব্লক করা)
- Spintax সাপোর্ট: `{Hi|Hello|আসসালামু আলাইকুম}` — প্রতিটা মেসেজে ভিন্নতা আনার জন্য
- STOP/বন্ধ লিখলে অটো opt-out (contact-এর `opted_out` ফ্ল্যাগ সেট, আর কোনো ক্যাম্পেইন মেসেজ যাবে না)
- নাম্বার ডিসকানেক্ট/ব্যান হলে ইউজারকে সাথে সাথে ইন-অ্যাপ + ইমেইল নোটিফিকেশন

## গুরুত্বপূর্ণ শেখা বিষয় (ভবিষ্যতে মনে রাখতে)
- **WhatsApp LID প্রাইভেসি সিস্টেম** — group participant/mention/sender ফিল্ডে কখনো কখনো ফোন নাম্বারের বদলে একটা internal ID (LID, যেমন `128811135979553`) আসে — সেভ করা কন্টাক্ট নাম দিয়ে মেনশন করলে এটা হয়, এমনকি bot নিজের group_members row-ও LID দিয়ে সেভ হতে পারে। তাই কোনো লজিক phone নাম্বার ম্যাচিং-এর উপর নির্ভর করলে ব্যর্থ হতে পারে। সমাধান: provider-নিজস্ব পারমিশন এনফোর্সমেন্টের উপর নির্ভর করা (যেমন delete/action চেষ্টা করে এরর catch করা) phone-ম্যাচিং প্রি-চেকের চেয়ে বেশি নির্ভরযোগ্য। Workaround: কন্টাক্ট নাম না বেছে সরাসরি ফোন নাম্বার টাইপ করে মেনশন করলে LID এর বদলে আসল নাম্বার আসে।
- **WhatsApp multi-device JID এ `:deviceId` সাফিক্স** — (যেমন `8801938187802:16@s.whatsapp.net`) — ফোন নাম্বার বের করার সময় শুধু `@domain` কাটলে এই `:deviceId` অংশ থেকে যায়, ম্যাচিং ব্যর্থ হয়। সঠিক পদ্ধতি: `jid.split("@")[0].split(":")[0]`।
- **`bigserial`/`serial` কলামের sequence-এ আলাদা GRANT লাগে** — টেবিলের GRANT সেটা কভার করে না, নাহলে লাইভে `permission denied for sequence` এরর হয় (migration 0024 দেখো)।
- **তারিখ/সময় সবসময় `Asia/Dhaka` স্পষ্ট করে দেখাতে হবে** — `toLocaleString("bn-BD")` timezone ছাড়া দিলে যে এনভায়রনমেন্টে কোড চলে (সার্ভার-সাইড রেন্ডারে VPS/UTC হতে পারে, "use client" কম্পোনেন্টও প্রথমবার সার্ভারে রেন্ডার হয়) সেটার timezone ব্যবহার করে, ভুল সময় দেখাতে পারে। শেয়ার্ড হেল্পার ব্যবহার করা: `apps/web/lib/format-date.ts` (`formatDhakaDateTime`/`formatDhakaDate`, `timeZone: "Asia/Dhaka"` স্পষ্ট করে দেওয়া)। `datetime-local` ইনপুট থেকে সময় নেওয়ার সময়ও ব্রাউজারেই (client-side, ফর্ম সাবমিট করার আগে) সঠিক UTC instant এ কনভার্ট করে সার্ভারে পাঠাতে হবে — সার্ভারে কনভার্ট করলে সার্ভারের timezone ধরে ভুল হয়ে যায়।
- **Evolution-এর webhook ইভেন্ট গ্লোবাল env var দিয়ে সেট হয় না** — প্রতিটা instance-এর জন্য আলাদাভাবে API কলে (`createInstance`/`setWebhook`, `packages/core/providers/evolution.ts`-এর `WEBHOOK_EVENTS` লিস্ট) সাবস্ক্রাইব করতে হয়। নতুন ইভেন্ট টাইপ যোগ করলে আগে থেকে কানেক্টেড নাম্বারে আবার `setWebhook` কল করা লাগে (Groups পেজের "Webhook ইভেন্ট রিফ্রেশ করুন" বাটন)।
- **গ্রুপ মেসেজে delivered/read status সাধারণত আসে না** — WhatsApp/Baileys-এর নিজস্ব সীমাবদ্ধতা (per-recipient জটিলতা, কোনো aggregate "group read" ইভেন্ট নেই), কোড বাগ না।

## রোডম্যাপ

### MVP (সম্পন্ন)
1. Auth + workspace (multi-tenant)
2. নাম্বার কানেক্ট: QR scan, কানেকশন স্ট্যাটাস
3. কন্টাক্ট: CSV/Excel import, ম্যানুয়াল যোগ, ট্যাগ/গ্রুপ, ডুপ্লিকেট বাদ, নাম্বার অটো-ফরম্যাট (01XXX → 8801XXX)
4. টেমপ্লেট: `{{name}}` ভেরিয়েবল, spintax
5. ক্যাম্পেইন: টেক্সট + ছবি/PDF, অডিয়েন্স বাছাই, শিডিউল, র‍্যান্ডম ডিলে
6. ডেলিভারি রিপোর্ট: sent/delivered/read/failed, failed retry
7. প্ল্যান ও পেমেন্ট: মেসেজ লিমিট প্যাকেজ, bKash/Nagad (SSLCommerz পরে যোগ করা যায় এমন abstraction সহ)
8. **AI Chatbot** (n8n AI Agent স্টাইল) — কোনো hardcoded keyword-rule নেই, workspace-এর system prompt-ই একমাত্র নিয়ন্ত্রক। Knowledge base (PDF/XLSX/CSV/TXT) ছোট হলে full-text agent মোড (পুরো ডকুমেন্ট সরাসরি context), বড় হলে chunk+embedding retrieval (fallback, top-8)। Multi-turn history (শেষ ১০ মেসেজ), order-context আর ডেলিভারি-সময় সেটিংস প্রতিটা কলে context হিসেবে যোগ হয়। জটিল/multi-part প্রশ্নে ধাপে ধাপে চিন্তা করার নির্দেশনা প্রম্পটে আছে। রিপ্লাই পাঠানোর আগে ১-২ সেকেন্ড "টাইপ করছে..." presence (মানুষ-এজেন্টের মতো অনুভূতি)। LLM নিজেই বুঝলে না জানলে `needs_human` হ্যান্ডঅফ, প্রকৃত টেকনিক্যাল ব্যর্থতায় সাপোর্ট-নাম্বার সহ safety-net মেসেজ।
9. **Orders** — চ্যাটবট কথোপকথনে অর্ডার কনফার্ম হলে LLM একটা মার্কার-ব্লক দেয়, worker সেটা পার্স করে `orders` টেবিলে সেভ করে (ছোট readable order ID সহ, কাস্টমারকে জানানো হয়)। Status history লগ থাকে, ড্যাশবোর্ড থেকে status বদলালে কাস্টমারকে automatic WhatsApp আপডেট যায় (cancel করলে কারণসহ)।

### ফেজ ২ — Group Tools (সম্পন্ন, ৯/৯ সাব-ফিচার)
- ✅ গ্রুপ sync (নাম/বর্ণনা/মেম্বার/অ্যাডমিন লিস্ট, ইনভাইট লিংক জেনারেট/রোটেট)
- ✅ কিওয়ার্ড/@mention ট্রিগার — fixed টেক্সট অথবা AI রিপ্লাই (১:১ চ্যাটবটের একই কোর reuse করে), per-rule cooldown
- ✅ নতুন মেম্বার ওয়েলকাম মেসেজ (`{{group_name}}`/`{{invite_link}}` প্লেসহোল্ডার সহ)
- ✅ মেসেজ লগ/আর্কাইভ + সার্চ পেজ, মিডিয়া ডাউনলোড (Evolution `getBase64FromMediaMessage`), outbound delivery status ট্র্যাকিং (গ্রুপে delivered/read ack সাধারণত আসে না — WhatsApp/Baileys এর নিজস্ব সীমাবদ্ধতা, কোড বাগ না)
- ✅ স্প্যাম/ব্যানড-ওয়ার্ড/লিংক ফিল্টার — bot অ্যাডমিন হলে auto-delete (আগে থেকে permission প্রি-চেক করা হয় না, WhatsApp/Evolution নিজেই এনফোর্স করে — LID প্রাইভেসি সিস্টেমের কারণে phone-ভিত্তিক প্রি-চেক অনির্ভরযোগ্য প্রমাণিত হয়েছিল), না হলে ড্যাশবোর্ড নোটিফিকেশন
- ✅ Admin-only পোস্ট মোড টগল
- ✅ শিডিউলড অ্যানাউন্সমেন্ট/পোল — একাধিক গ্রুপে staggered delay সহ, per-group দৈনিক লিমিট
- ✅ Inactive/স্প্যাম মেম্বার auto-flag (৩০ দিন নিষ্ক্রিয়, বা ফিল্টার-ম্যাচ) — কখনো auto-remove না, শুধু ড্যাশবোর্ডে দেখানো
- ✅ Structured (non-AI, regex) অর্ডার ক্যাপচার — "ORDER: নাম, নাম্বার, প্রোডাক্ট" ফরম্যাটে, AI ছাড়াই `orders` টেবিলে সেভ হয়
- **গুরুত্বপূর্ণ শিক্ষা**: WhatsApp-এর LID প্রাইভেসি সিস্টেমের কারণে group participant/mention/sender কখনো কখনো ফোন নাম্বারের বদলে internal ID (LID) দিয়ে আসে — কোনো লজিক phone নাম্বার ম্যাচিং-এর উপর নির্ভর করলে সেটা ব্যর্থ হতে পারে; সম্ভব হলে provider-নিজস্ব পারমিশন এনফোর্সমেন্টের উপর নির্ভর করা (যেমন delete চেষ্টা করে এরর ধরা) phone ম্যাচিং প্রি-চেকের চেয়ে বেশি নির্ভরযোগ্য
- বাকি ফেজ ২ আইটেম (শেয়ার্ড ইনবক্স + টিম অ্যাসাইন, নাম্বার চেকার, মাল্টি-নাম্বার লোড ব্যালান্স, বাংলা টেমপ্লেট লাইব্রেরি) এখনো শুরু হয়নি

### ফেজ ৩ (স্কেলের সময়)
Meta Cloud API, চ্যাটবট বিল্ডার, পাবলিক API + ওয়েবহুক, ড্রিপ ক্যাম্পেইন, অ্যানালিটিক্স, রিসেলার/হোয়াইট-লেবেল

## Messenger চ্যানেল (নতুন, শুরু হয়েছে — `messenger` ব্রাঞ্চে)
- পুরো কাজ `messenger` গিট ব্রাঞ্চে, `main` এ না — WhatsApp এর কোনো টেবিল/server action/worker প্রসেসর এই কাজে ছোঁয়া হয় না
- **M0 (কাঠামো) সম্পন্ন**: `messenger_pages`/`messenger_conversations`/`messenger_messages` টেবিল (migration 0040-0041, আলাদা টেবিল, WhatsApp এর সাথে merge না — কারণ বিস্তারিত `docs/messenger-plan.md` তে), `packages/core/providers/messenger-types.ts` (শুধু ইন্টারফেস, কোনো implementation class না), সাইডবার চ্যানেল সুইচার (WhatsApp | Messenger, URL-ভিত্তিক: `/dashboard/messenger/...`), `nav-config.ts` একমাত্র উৎস, ড্যাশবোর্ডে সব/WhatsApp/Messenger ট্যাব
- **ফিচার ফ্ল্যাগ**: `NEXT_PUBLIC_MESSENGER_ENABLED` (ডিফল্ট `false`) — বন্ধ থাকলে সুইচার/মেনু/রুট সব লুকানো বা 404, বিটা ইউজার কিছুই দেখে না। `.env.example` এ যোগ করা আছে, আসল `.env` এ বসাতে হবে চালু করতে চাইলে
- **workspace_ai_settings ও নলেজ বেস** দুই চ্যানেলেই শেয়ার্ড (আলাদা কনফিগ না) — `tryAiReply()` কোর সম্পূর্ণ reuse হবে, শুধু `whatsappNumberId` প্যারামিটার M2 তে generic করতে হবে (নোট `docs/messenger-plan.md` এ)
- **পরের ধাপ**: M1 (পেজ কানেক্ট ও webhook — Meta App Review লাগবে, দরকারি পারমিশন ডকুমেন্টে আছে) → M2 (ইনবক্স ও AI) → M3 (কমেন্ট অটোমেশন, এই ধাপে `orders.channel`/`messenger_page_id` migration) → M4 (পোস্ট শিডিউলার) → M5 (মডারেশন) — বিস্তারিত `docs/messenger-plan.md`

## ডিপ্লয়মেন্ট
- সব সার্ভিসের Dockerfile + docker-compose, Nginx + SSL config
- গ্রোথ প্ল্যান: ০-৫০ ইউজার (এক VPS) → ৫০-২০০ (Evolution+worker আলাদা সার্ভার) → ২০০+ (মাল্টি Evolution + মাল্টি worker + LB)
- সব সার্ভিসে `/health` এন্ডপয়েন্ট (Uptime Kuma + n8n দিয়ে Telegram অ্যালার্ট)
- `DEPLOY.md` বাংলায়: VPS সেটআপ, Docker, Nginx, SSL, `.env`, নতুন সার্ভার যোগ করার নিয়ম

## Git
- Remote: `https://github.com/tayef02/whatsapp-saas.git` (private, খালি)
- `.gitignore`-এ অবশ্যই থাকবে: `.env`, `.env.local`, `node_modules`, WhatsApp session ডাটা
- বিল্ড/টাইপ-চেক (worker: `tsc --noEmit`, web: `next build`) ক্লিন থাকলে সরাসরি commit + push — আলাদা কনফার্মেশনের জন্য থামা লাগবে না। শুধু বড় স্কিমা-পরিবর্তন বা risky migration (টেবিল/কলাম ড্রপ, ডাটা-লস হতে পারে এমন) হলে push করার আগে ইউজারকে জানাতে হবে।
