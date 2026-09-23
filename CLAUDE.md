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
9. **RLS/GRANT বাধ্যতামূলক** — Supabase প্রজেক্টে "Automatically expose new tables" বন্ধ আর "automatic RLS" চালু আছে। তাই **প্রতিটা migration-এ প্রতিটা নতুন টেবিলের জন্য স্পষ্ট `GRANT` স্টেটমেন্ট আর RLS policy লিখতে হবে**, যাতে প্রতি workspace শুধু নিজের ডাটা দেখতে পায়। কোনো টেবিল RLS policy ছাড়া রেখে দেওয়া চলবে না।
10. **WhatsApp সেশন ডাটা** persistent volume-এ রাখা (Docker volume), সার্ভার রিস্টার্টে যেন সেশন না হারায়।
11. Worker আর Evolution API আলাদা সার্ভারে ডিপ্লয় করা যায় এমনভাবে কনফিগারেবল (env ভিত্তিক host/port)।

## সেফটি নিয়ম (নাম্বার ব্যান ঠেকাতে — সব ফেজে বাধ্যতামূলক)
- প্রতি নাম্বারে দৈনিক পাঠানোর সর্বোচ্চ সীমা
- ওয়ার্ম-আপ মোড: নতুন কানেক্ট করা নাম্বারে প্রথম কয়েকদিন কম লিমিট, ধীরে ধীরে বাড়বে
- মেসেজের মাঝে ন্যূনতম ডিলে বাধ্যতামূলক + র‍্যান্ডম ডিলে (খুব দ্রুত পাঠানো ব্লক করা)
- Spintax সাপোর্ট: `{Hi|Hello|আসসালামু আলাইকুম}` — প্রতিটা মেসেজে ভিন্নতা আনার জন্য
- STOP/বন্ধ লিখলে অটো opt-out (contact-এর `opted_out` ফ্ল্যাগ সেট, আর কোনো ক্যাম্পেইন মেসেজ যাবে না)
- নাম্বার ডিসকানেক্ট/ব্যান হলে ইউজারকে সাথে সাথে ইন-অ্যাপ + ইমেইল নোটিফিকেশন

## রোডম্যাপ

### MVP (এখন)
1. Auth + workspace (multi-tenant)
2. নাম্বার কানেক্ট: QR scan, কানেকশন স্ট্যাটাস
3. কন্টাক্ট: CSV/Excel import, ম্যানুয়াল যোগ, ট্যাগ/গ্রুপ, ডুপ্লিকেট বাদ, নাম্বার অটো-ফরম্যাট (01XXX → 8801XXX)
4. টেমপ্লেট: `{{name}}` ভেরিয়েবল, spintax
5. ক্যাম্পেইন: টেক্সট + ছবি/PDF, অডিয়েন্স বাছাই, শিডিউল, র‍্যান্ডম ডিলে
6. ডেলিভারি রিপোর্ট: sent/delivered/read/failed, failed retry
7. প্ল্যান ও পেমেন্ট: মেসেজ লিমিট প্যাকেজ, bKash/Nagad (SSLCommerz পরে যোগ করা যায় এমন abstraction সহ)

### ফেজ ২ (স্কিমায় জায়গা রাখা হয়েছে, এখনই বানানো হচ্ছে না)
শেয়ার্ড ইনবক্স + টিম মেম্বার অ্যাসাইন, কিওয়ার্ড/AI অটো-রিপ্লাই (OpenAI/Gemini), গ্রুপ টুলস, নাম্বার চেকার, মাল্টি-নাম্বার লোড ব্যালান্স, বাংলা টেমপ্লেট লাইব্রেরি

### ফেজ ৩ (স্কেলের সময়)
Meta Cloud API, চ্যাটবট বিল্ডার, পাবলিক API + ওয়েবহুক, ড্রিপ ক্যাম্পেইন, অ্যানালিটিক্স, রিসেলার/হোয়াইট-লেবেল

## ডিপ্লয়মেন্ট
- সব সার্ভিসের Dockerfile + docker-compose, Nginx + SSL config
- গ্রোথ প্ল্যান: ০-৫০ ইউজার (এক VPS) → ৫০-২০০ (Evolution+worker আলাদা সার্ভার) → ২০০+ (মাল্টি Evolution + মাল্টি worker + LB)
- সব সার্ভিসে `/health` এন্ডপয়েন্ট (Uptime Kuma + n8n দিয়ে Telegram অ্যালার্ট)
- `DEPLOY.md` বাংলায়: VPS সেটআপ, Docker, Nginx, SSL, `.env`, নতুন সার্ভার যোগ করার নিয়ম

## Git
- Remote: `https://github.com/tayef02/whatsapp-saas.git` (private, খালি)
- `.gitignore`-এ অবশ্যই থাকবে: `.env`, `.env.local`, `node_modules`, WhatsApp session ডাটা
- প্রতিটা মডিউল ইউজার টেস্ট করে ঠিক বললে তবেই commit + push হবে — নিজে থেকে push করা যাবে না
