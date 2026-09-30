# Messenger চ্যানেল — রোডম্যাপ (M0-M5)

এই ডকুমেন্ট Facebook Messenger চ্যানেল যোগ করার প্রতিটা ধাপের পরিকল্পনা রাখে। **M0 (কাঠামো) ও
M1 (পেজ কানেক্ট + webhook + টেক্সট ইনবক্স) সম্পন্ন** — টেস্ট করার ধাপ নিচে "M1 টেস্ট করার
ধাপ" সেকশনে আছে। এখনো বাকি: AI রিপ্লাই (M2), কমেন্ট অটোমেশন (M3), পোস্ট শিডিউলার (M4),
মডারেশন (M5)।

## ব্রাঞ্চ ও ফ্ল্যাগ

- সব কাজ `messenger` ব্রাঞ্চে, `main` এ merge হবে যখন কমপক্ষে M1 (পেজ কানেক্ট) শেষ হয়ে
  বাস্তবে টেস্ট করা সম্ভব হবে।
- `NEXT_PUBLIC_MESSENGER_ENABLED` (ডিফল্ট `false`) — সাইডবারে চ্যানেল সুইচার, Messenger মেনু
  আইটেম, ড্যাশবোর্ড চ্যানেল-ট্যাব, আর `/dashboard/messenger/*` রুট — সবকিছুই এই ফ্ল্যাগ দিয়ে
  গেট করা। `false` থাকলে পুরো অ্যাপ আজকের মতোই দেখাবে, কোনো বিটা ইউজার Messenger এর
  আধাখেচড়া অবস্থা দেখবে না। Meta App Review পাস হলে (M1 শেষে) `true` করা হবে।

## M0 — কাঠামো (সম্পন্ন)

- `messenger_pages`, `messenger_conversations`, `messenger_messages` টেবিল (migration 0040, 0041) —
  WhatsApp এর কোনো টেবিল থেকে সম্পূর্ণ আলাদা, কারণ পরের সেকশনে ব্যাখ্যা করা হয়েছে।
- `packages/core/providers/messenger-types.ts` — `MessengerProvider` ইন্টারফেস (শুধু টাইপ,
  কোনো implementation class না)। WhatsAppProvider থেকে আলাদা কারণ Messenger এর গ্রুপ/পোল/
  admin-mode নেই, কিন্তু কমেন্ট/পোস্ট/২৪-ঘণ্টা উইন্ডোর মতো WhatsApp এ নেই এমন concept আছে।
- সাইডবার চ্যানেল সুইচার (`Sidebar.tsx`), URL-ভিত্তিক চ্যানেল ডিটেকশন, `nav-config.ts` একমাত্র
  উৎস (WhatsApp + Messenger দুই তালিকার নেভিগেশন)।
- Messenger এর সব সাব-পেজ "শীঘ্রই" খোলস, পেজ-কানেক্ট পেজে নিষ্ক্রিয় বাটন।
- ড্যাশবোর্ড হোমে সব/WhatsApp/Messenger ট্যাব — Messenger ট্যাবে কোনো কোয়েরি চলে না, শুধু
  গাইড কার্ড।

### কেন আলাদা টেবিল (WhatsApp এর সাথে merge না করে)

1. Messenger এর পরিচয় PSID (Page-Scoped ID) ভিত্তিক — WhatsApp এর ফোন-নাম্বার-কেন্দ্রিক
   `contacts`/`conversations` এ মেলে না (Facebook সাধারণত ফোন/ইমেইল দেয়ই না)।
2. আলাদা টেবিল রাখলে WhatsApp এর বিদ্যমান RLS/কোয়েরি/worker প্রসেসর একদমই ছোঁয়া লাগে না।
3. Messenger এর নিজস্ব কমপ্লায়েন্স মডেল (২৪-ঘণ্টা উইন্ডো + message tag) WhatsApp এর
   STOP-কিওয়ার্ড opt-out মডেলের থেকে সম্পূর্ণ আলাদা।
4. ভবিষ্যতে আরেকটা চ্যানেল (Instagram DM) এলে এই একই প্যাটার্ন রিপিট করা যাবে।

**সীমাবদ্ধতা**: Messenger কাস্টমার WhatsApp এর `contacts` এ merge হবে না — একই কাস্টমার
দুই চ্যানেলে মেসেজ করলে দুইটা আলাদা রেকর্ড থাকবে। ইউনিফায়েড CRM এখন স্কোপে নেই।

### `workspace_ai_settings` ও নলেজ বেস শেয়ার্ড

Messenger এর জন্য আলাদা AI সেটিংস টেবিল নেই — একই ব্যবসার তথ্য (system prompt, নলেজ বেস,
সাপোর্ট নাম্বার) দুই চ্যানেলেই প্রযোজ্য। `tryAiReply()` কোর (system prompt + knowledge base +
history + order-context) সম্পূর্ণ চ্যানেল-নিরপেক্ষ, হুবহু reuse হবে।

**M2 এ যা বদলাতে হবে**: `tryAiReply()`-এর সিগনেচারে এখন `whatsappNumberId: string` আছে (শুধু
চ্যাটে অর্ডার কনফার্ম হলে `saveOrder()`-এ `orders.whatsapp_number_id` ট্যাগ করতে ব্যবহার
হয়)। M2 এ এটাকে generic করতে হবে, যেমন:
```ts
channel: { type: "whatsapp"; whatsappNumberId: string } | { type: "messenger"; messengerPageId: string }
```
এই বদল `apps/worker/src/processors/process-webhook.ts`-এর বিদ্যমান কল-সাইট ছোঁবে — তাই M0
এ করা হয়নি (WhatsApp লজিক অপরিবর্তিত রাখার শর্ত অনুযায়ী), M2 এ Messenger ইনবক্স+AI
বানানোর সময় সাবধানে করতে হবে (WhatsApp এর কল-সাইটে `{ type: "whatsapp", whatsappNumberId }`
পাস করে বিদ্যমান আচরণ অপরিবর্তিত রাখা)।

### `orders` টেবিল — M3 পর্যন্ত মুলতবি

`channel`/`messenger_page_id` কলাম M0 এ যোগ হয়নি (সিদ্ধান্ত: M3 তে কমেন্ট-থেকে-অর্ডার ফিচারের
সাথে একসাথে হবে)। তখনকার খসড়া:
```sql
alter table public.orders
  add column channel text not null default 'whatsapp' check (channel in ('whatsapp', 'messenger')),
  add column messenger_page_id uuid references public.messenger_pages (id) on delete set null;
```
ঝুঁকি কম (DEFAULT সহ additive কলাম, PostgreSQL এ metadata-only অপারেশন) — কিন্তু লাইভ
`orders` টেবিল বলে কম-ট্রাফিকের সময় চালানোর পরামর্শ, তখনকার প্রেক্ষাপটে আবার যাচাই করে নিতে হবে।

---

## M1 — পেজ কানেক্ট ও Webhook (সম্পন্ন)

**লক্ষ্য**: Facebook Login for Business দিয়ে OAuth flow, Page Access Token আনা (Vault এ
সেভ), webhook সাবস্ক্রাইব করা, শুধু-টেক্সট ইনবক্স (AI ছাড়া)।

**দরকারি Meta পারমিশন** ([Meta ডকুমেন্টেশন](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview) অনুযায়ী):
- `pages_show_list` — ইউজারের পেজ তালিকা দেখতে (কোনটা কানেক্ট করবে বাছাই করার জন্য)
- `pages_manage_metadata` — পেজের জন্য Messenger webhook ইভেন্ট সাবস্ক্রাইব/আনসাবস্ক্রাইব করতে
- `pages_messaging` — মূল পারমিশন, মেসেজ পাঠানো/পড়ার জন্য
- `pages_read_engagement` — পেজের কনটেন্ট/এনগেজমেন্ট পড়তে
- `business_management` — উপরের কয়েকটার (`pages_messaging`, `pages_show_list`) নির্ভরতা,
  App Review submission এ আলাদাভাবে উল্লেখ করতে হবে

এই সবগুলোই Advanced Access দরকার হয় প্রোডাকশনে, মানে **Meta App Review বাধ্যতামূলক** —
রিভিউ টিম বট টেস্ট করে দেখবে প্রতিটা পারমিশন আসলেই দরকার কিনা। App Review এর আগে **App Roles
এ যোগ করা টেস্ট ইউজার/টেস্ট পেজ দিয়ে Development mode এ টেস্ট করা যায়** (নিচের টেস্ট সেকশন
দেখুন) — রিভিউ ছাড়াই।

**যা বানানো হয়েছে**:
- `packages/core/providers/messenger.ts` — `MetaMessengerProvider` ক্লাস (Graph API v21.0):
  OAuth dialog URL, code→token এক্সচেঞ্জ, long-lived token, পেজ তালিকা (`listPages`),
  webhook সাবস্ক্রাইব/আনসাবস্ক্রাইব, `sendMessage`, `getUserProfile`।
- `supabase/migrations/0042_messenger_vault_functions.sql` — `set_messenger_page_token`/
  `get_messenger_page_token`/`clear_messenger_page_token` RPC (Vault প্যাটার্ন,
  `workspace_ai_settings.api_key_secret_id` এর মতোই — `get_messenger_page_token` শুধু
  `service_role` কল করতে পারে)।
- `/dashboard/messenger/connect/start`, `/callback`, `/select` — OAuth flow, পেজ টোকেন
  কখনো URL/DB প্লেইন কলামে না, শুধু অল্প-সময়ের httpOnly কুকিতে (single-use) থেকে সরাসরি
  Vault এ যায়। পেজ ডিসকানেক্ট করলে webhook আনসাবস্ক্রাইব + Vault থেকে টোকেন মুছে যায়।
- `/api/webhooks/messenger` — GET এ `hub.verify_token` যাচাই, POST এ raw body দিয়ে
  `X-Hub-Signature-256` timing-safe যাচাই, তারপর `messenger-webhook-events` কিউতে পুশ করে
  সাথে সাথে `200 OK` (কোনো DB কাজ webhook route এ হয় না — WhatsApp এর webhook এর একই নিয়ম)।
- আলাদা BullMQ কিউ (`messenger-webhook-events`, `messenger-jobs`) ও আলাদা `Worker` —
  WhatsApp এর `evolution-webhook-events`/`chatbot-autoreply` এর সাথে কোনো মিশ্রণ নেই।
- `apps/worker/src/processors/process-messenger-webhook.ts` — কনভারসেশন upsert, মেসেজ
  insert (dedup `provider_message_id` দিয়ে), কাস্টমার নাম Graph API থেকে best-effort ফেচ।
  ছবি/ফাইল এখন শুধু "[ছবি পাঠিয়েছে]" টাইপ প্লেসহোল্ডার — আসল ডাউনলোড M2 তে।
- `/dashboard/messenger/inbox` — WhatsApp ইনবক্সের একই ডিজাইন, দুইটা ট্যাব (সব/উত্তর বাকি),
  প্রতিটা কথোপকথনে "২৪ ঘণ্টার উইন্ডো: X ঘণ্টা বাকি" ব্যাজ, উইন্ডো শেষ হলে রিপ্লাই বক্স বন্ধ।
  এজেন্ট রিপ্লাইও `messenger-jobs` কিউ দিয়ে যায় (Next.js থেকে সরাসরি Graph API কল না) —
  **কোনো AI/বট রিপ্লাই এই ধাপে নেই**, শুধু মানুষ-এজেন্ট ম্যানুয়াল রিপ্লাই।
- ড্যাশবোর্ড Messenger ট্যাবে এখন আসল সংখ্যা (কানেক্টেড পেজ, মোট কথোপকথন, আজকের মেসেজ) —
  কোনো পেজ কানেক্ট না থাকলে আগের মতোই গাইড কার্ড দেখাবে।

**জানা সীমাবদ্ধতা (M1 তে ইচ্ছাকৃতভাবে বাদ)**: ছবি/ফাইল ডাউনলোড, AI/বট রিপ্লাই, human_agent
ট্যাগ দিয়ে উইন্ডো বাড়ানো — এই তিনটা M2 তে আসবে।

---

## M2 — ইনবক্স ও AI

**লক্ষ্য**: কাস্টমার মেসেজ পেলে `messenger_messages` এ সেভ, `tryAiReply()` (generalized,
উপরে দেখুন) দিয়ে রিপ্লাই, ইনবক্স UI (WhatsApp ইনবক্সের প্যাটার্নে)।

**২৪-ঘণ্টা মেসেজিং উইন্ডো** ([Meta পলিসি ডকুমেন্টেশন](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy)):
- কাস্টমার মেসেজ পাঠালে ২৪ ঘণ্টার একটা উইন্ডো খোলে — এর মধ্যে যেকোনো কনটেন্ট (প্রমোশনালসহ)
  পাঠানো যায়। প্রতিবার কাস্টমার আবার মেসেজ করলে উইন্ডো রিসেট হয়। এই টাইমস্ট্যাম্প
  `messenger_conversations.last_user_message_at` এ ট্র্যাক করা হয় (M0 তেই কলাম রাখা আছে)।
- উইন্ডোর বাইরে **শুধু non-promotional** মেসেজ পাঠানো যায়, আর তখন একটা **message tag**
  লাগবে (promotional content — ডিসকাউন্ট কোড, সেল, অফার — tag দিয়েও পাঠানো যায় না)।
- **human_agent tag**: কোনো এজেন্ট একটা সমস্যা সমাধান করার চেষ্টা করলে উইন্ডো ৭ দিন পর্যন্ত
  বাড়ানো যায় — ইনবক্সে "hand off" হওয়া কথোপকথনের জন্য প্রাসঙ্গিক (WhatsApp এর
  `handed_off` স্ট্যাটাসের সমান্তরাল ধারণা)।
- **One-time notification**: ২৪ ঘণ্টা শেষ হওয়ার পর কাস্টমারকে একটা ফলো-আপ মেসেজ পাঠানোর
  অনুরোধ করা যায় (এটা Instagram এ নেই, শুধু Messenger এ)।

**কাজ**: `handleIncomingMessage`-এর Messenger সংস্করণ (নতুন ফাইল, WhatsApp এর
`process-webhook.ts` স্পর্শ না করে), dedup (`messenger_messages_provider_msg_idx`, M0 তেই
আছে), উইন্ডো-চেক লজিক (send করার আগে `last_user_message_at` দেখে ২৪ ঘণ্টা পার হয়েছে
কিনা, হলে message tag লাগবে)।

---

## M3 — কমেন্ট অটোমেশন

**লক্ষ্য**: পোস্টের কমেন্টে কিওয়ার্ড/AI দিয়ে অটো-রিপ্লাই (WhatsApp গ্রুপ কিওয়ার্ড রিপ্লাই
ফিচারের সমান্তরাল), কমেন্ট থেকে অর্ডার ক্যাপচার (এই ধাপেই `orders.channel`/
`messenger_page_id` migration চলবে)।

**দরকারি Meta পারমিশন** ([Pages API ডকুমেন্টেশন](https://developers.facebook.com/documentation/pages-api)):
- `pages_manage_engagement` — কমেন্টে রিপ্লাই/হাইড/ডিলিট করতে (মূল পারমিশন)
- `pages_read_user_content` — ভিজিটরের পোস্ট/কমেন্ট পড়তে
- webhook `feed` field — নতুন কমেন্ট রিয়েল-টাইমে পেতে

---

## M4 — পোস্ট শিডিউলার

**লক্ষ্য**: নির্দিষ্ট সময়ে পেজে টেক্সট/ছবি পোস্ট পাবলিশ (WhatsApp এর শিডিউলড
অ্যানাউন্সমেন্টের সমান্তরাল — staggered delay এর দরকার নেই যেহেতু এটা একটা পোস্ট, একাধিক
গ্রুপে পাঠানো না)।

**দরকারি Meta পারমিশন**: `pages_manage_posts` — পেজে পোস্ট তৈরি/এডিট/ডিলিট করতে।

**কাজ**: `POST /{page-id}/feed` (টেক্সট) বা `/{page-id}/photos` (ছবিসহ), শিডিউলিং এর জন্য
BullMQ delayed job (WhatsApp announcement scheduler এর প্যাটার্নে)।

---

## M5 — মডারেশন

**লক্ষ্য**: স্প্যাম/ব্যানড-ওয়ার্ড ফিল্টার কমেন্টে (WhatsApp গ্রুপ স্প্যাম ফিল্টারের সমান্তরাল),
ইনঅ্যাক্টিভ/স্প্যাম ইউজার ফ্ল্যাগ করা (auto-remove না, শুধু দেখানো — WhatsApp এর একই নীতি)।

**পারমিশন**: M3 এর `pages_manage_engagement` যথেষ্ট (হাইড/ডিলিট একই পারমিশনে কভার হয়)।

---

## M1 টেস্ট করার ধাপ

### ১. Meta App সেটআপ (একবারই করতে হবে)

1. [Meta for Developers](https://developers.facebook.com/apps) এ একটা নতুন App বানান, টাইপ
   "Business"। App ID ও App Secret (Settings → Basic) কপি করে রাখুন।
2. App এ "Messenger" প্রোডাক্ট যোগ করুন (Add Product)।
3. Development mode এ App Roles → Roles এ নিজেকে (এবং যাদের পেজে টেস্ট করবেন তাদের) Admin/
   Tester হিসেবে যোগ করুন — App Review ছাড়াই Development mode এ টেস্ট-ইউজার নিজের পেজ
   কানেক্ট করতে পারবেন।
4. Facebook Login for Business সেটআপ (App → Facebook Login for Business → Settings) এ
   Valid OAuth Redirect URI বসান: `{MESSENGER_PUBLIC_URL}/dashboard/messenger/connect/callback`
   (লোকাল টেস্টে টানেল HTTPS URL, প্রোডাকশনে আসল ডোমেইন — নিচে দেখুন)। **অবশ্যই https** —
   http দিলে Facebook "isn't using a secure connection" এরর দেখায়, কানেক্ট flow শুরুই হয় না।

### ২. `.env.local` এ যা বসাতে হবে (নাম, মান নিজে Meta App থেকে বসাবেন)

`apps/web/.env.example` এ এই চারটা নাম আগে থেকেই আছে — `.env.local` এ আসল মান বসান:

```
MESSENGER_APP_ID=          # Meta App এর App ID
MESSENGER_APP_SECRET=      # Meta App এর App Secret — কখনো git এ কমিট না
MESSENGER_PUBLIC_URL=      # পাবলিক HTTPS base URL, শেষে / ছাড়া (যেমন https://xxxx.ngrok-free.app)
                           # — শুধু OAuth redirect_uri বানাতে ব্যবহার হয়, WhatsApp এর APP_URL
                           # (docker-internal http হতে পারে) থেকে সম্পূর্ণ আলাদা, রিইউজ করা হয় না
MESSENGER_WEBHOOK_VERIFY_TOKEN=   # নিজে একটা র‍্যান্ডম স্ট্রিং বানান (যেমন openssl rand -hex 16) —
                                    # এটাই webhook সেটআপের সময় Meta তে "Verify Token" ফিল্ডে বসবে
```

`NEXT_PUBLIC_MESSENGER_ENABLED=true` করুন যাতে সাইডবার/মেনু/রুট আনলক হয়।

**`MESSENGER_PUBLIC_URL` না থাকলে বা `https://` দিয়ে শুরু না হলে** কানেক্ট বাটনে ক্লিক করলে
সরাসরি "Messenger এখনো সেটআপ হয়নি" এরর দেখাবে (চুপচাপ localhost/http ধরে নেওয়া হয় না) —
`apps/web/lib/messenger-url.ts` এই যাচাই করে।

### ৩. Migration চালানোর ক্রম (Supabase SQL Editor এ নিজে চালাবেন, ক্রম গুরুত্বপূর্ণ)

1. `0040_messenger_pages.sql`
2. `0041_messenger_conversations_messages.sql`
3. `0042_messenger_vault_functions.sql`

তিনটাই একে অপরের উপর নির্ভরশীল ক্রমে (পরেরটা আগেরটার টেবিল রেফার করে), তাই এই ক্রম মানা
জরুরি। তিনটাই `create table if not exists`/`create or replace function` ধাঁচের, তাই দুইবার
ভুলে চললেও ক্ষতি নেই।

### ৪. লোকালে টেস্ট করা (পাবলিক HTTPS URL লাগবে — Meta লোকালhost webhook নেয় না)

Meta কে webhook subscribe করাতে একটা পাবলিক HTTPS URL লাগবে। লোকাল ডেভ সার্ভার (`localhost:3000`)
বাইরে থেকে দেখাতে একটা টানেল লাগবে — **ngrok** সবচেয়ে সহজ:

```bash
ngrok http 3000
```

এটা একটা URL দেবে (যেমন `https://xxxx.ngrok-free.app`) — এটাই টেস্টের সময়কার
`MESSENGER_PUBLIC_URL` হবে (`.env.local` এ বসান, শেষে `/` ছাড়া), আর Meta App
ড্যাশবোর্ডের OAuth redirect URI ও webhook callback URL দুটোতেই এই একই URL ব্যবহার হবে
(`APP_URL` এর আলাদা মান হতে পারে — ওটা শুধু WhatsApp/Evolution এর জন্য, এখানে অপ্রাসঙ্গিক)।

ngrok ছাড়া বিকল্প: **cloudflared** (`cloudflared tunnel --url http://localhost:3000`) — সেইম
কাজ, একাউন্ট ছাড়াই চলে।

⚠️ টানেল রিস্টার্ট করলে URL বদলে যায় (ফ্রি ngrok এ) — তাই প্রতিবার `.env.local`-এর
`MESSENGER_PUBLIC_URL`, Facebook Login for Business এর Valid OAuth Redirect URI, আর Meta
App এর webhook callback URL — তিন জায়গাতেই আপডেট করা লাগবে, নাহলে "redirect_uri mismatch"
বা signature-যাচাই ব্যর্থ হবে।

### ৫. Meta App এ Webhook সেটআপ

App ড্যাশবোর্ড → Messenger → Settings → Webhooks → "Add Callback URL":
- **Callback URL**: `{MESSENGER_PUBLIC_URL}/api/webhooks/messenger` (যেমন `https://xxxx.ngrok-free.app/api/webhooks/messenger`)
- **Verify Token**: ধাপ ২ এ `.env.local`-এ বসানো `MESSENGER_WEBHOOK_VERIFY_TOKEN` এর ঠিক একই মান
- সাবস্ক্রাইব করুন: `messages`, `messaging_postbacks`

"Verify and Save" চাপলে অ্যাপ চলন্ত থাকতে হবে (dev সার্ভার + টানেল দুটোই আপ) — Meta তখনই GET
রিকোয়েস্ট পাঠিয়ে verify token যাচাই করবে।

### ৬. পুরো ফ্লো টেস্ট

1. dev সার্ভার + টানেল চালু রেখে অ্যাপে লগইন করুন, সাইডবারে "Messenger" ট্যাবে যান।
2. "কানেক্ট করুন" চাপুন → Facebook লগইন ডায়ালগ → পারমিশন দিন → নিজের টেস্ট পেজ বাছাই করুন।
3. কানেক্ট হওয়ার পর `messenger_pages` এ status=`active` রো তৈরি হবে কিনা Supabase এ চেক করুন।
4. ঐ Facebook পেজে গিয়ে পেজের Messenger এ (facebook.com থেকে, অথবা পেজের পাবলিক লিংক থেকে
   "Message" বাটনে) একটা টেক্সট মেসেজ পাঠান।
5. অ্যাপের `/dashboard/messenger/inbox` এ কথোপকথন ও মেসেজ দেখা উচিত কয়েক সেকেন্ডের মধ্যে —
   না দেখা গেলে worker এর টার্মিনাল লগ (`messenger-webhook-events`/`messenger-jobs` মেনশন করা
   লাইন) চেক করুন।
6. ইনবক্স থেকে একটা রিপ্লাই পাঠান, Facebook এ (কাস্টমার সাইডে) মেসেজটা পৌঁছাচ্ছে কিনা দেখুন।
7. "ডিসকানেক্ট" চেপে `messenger_pages` এ status=`disconnected` হচ্ছে আর webhook আনসাবস্ক্রাইব
   হচ্ছে কিনা (Meta অ্যাপ ড্যাশবোর্ডে ঐ পেজের subscription লিস্টে আর না থাকা) যাচাই করুন।

### ৭. VPS এ ডিপ্লয় করা — `main` না ভেঙে

`messenger` ব্রাঞ্চ এখনো `main` এ merge হয়নি, তাই প্রোডাকশন VPS এ বর্তমান ডিপ্লয়মেন্ট
(যেটা সম্ভবত `main` চালাচ্ছে) স্পর্শ না করে টেস্ট করার সহজ উপায়:

**অপশন A (সুপারিশকৃত) — আলাদা ডিরেক্টরি/কন্টেইনারে পাশাপাশি চালানো**:
1. VPS এ রিপোর 2nd clone বানান আলাদা পাথে (যেমন `/opt/whatsapp-saas-messenger-test`), সেখানে
   `git checkout messenger`।
2. `docker-compose.yml` এ `apps/web`/`apps/worker` এর কন্টেইনার নাম ও পোর্ট বদলে আলাদা রাখুন
   (যেমন web `3001`, worker আলাদা কন্টেইনার নাম) যাতে `main`-এর চলমান কন্টেইনারের সাথে নাম/
   পোর্ট সংঘর্ষ না হয়। `.env` আলাদা (নিজস্ব Redis DB index বা আলাদা Redis কন্টেইনার ব্যবহার
   করলে BullMQ কিউ নামও আলাদা থাকায় নিরাপদ, কিন্তু আলাদা Redis রাখাই সবচেয়ে নিরাপদ)।
3. Nginx এ এই টেস্ট ইনস্ট্যান্সের জন্য একটা সাবডোমেইন (যেমন `messenger-test.yourdomain.com`)
   বা পাথ প্রক্সি করুন, SSL (Let's Encrypt) নিন — Meta কে এই URL দিন।
4. এই ইনস্ট্যান্সের `.env` এ `MESSENGER_PUBLIC_URL=https://messenger-test.yourdomain.com`
   (শেষে `/` ছাড়া) বসান — এটাই Facebook Login for Business এর Valid OAuth Redirect URI আর
   webhook callback URL এ ব্যবহৃত হবে। প্রোডাকশনে `main`-এ merge হওয়ার পর এটা আসল ডোমেইন হবে,
   যেমন `MESSENGER_PUBLIC_URL=https://app.yourdomain.com` (`APP_URL` থেকে আলাদা রাখা —
   `APP_URL` WhatsApp/Evolution এর জন্য docker-internal মান রাখতে পারে, `MESSENGER_PUBLIC_URL`
   সবসময় পাবলিক-থেকে-দেখা-যাওয়া https ডোমেইন হতে হবে)।
5. টেস্ট শেষে, M2+ ধাপ চলতে চলতে যখন `main` এ merge করার সময় আসবে, তখন এই টেস্ট ইনস্ট্যান্স
   বন্ধ করে স্বাভাবিক ডিপ্লয় প্রসেসে `main` আপডেট করবেন।

**অপশন B — একই ইনস্ট্যান্সে ব্রাঞ্চ বদলে টেস্ট (ঝুঁকিপূর্ণ, শুধু ট্রাফিক কম থাকা সময়ে)**:
`main`-এর ডিরেক্টরিতেই সাময়িকভাবে `git checkout messenger` করে rebuild/restart করলে সেই সময়
WhatsApp প্রোডাকশন ট্রাফিকও এই কোডে চলবে — Messenger কোড WhatsApp টেবিল/প্রসেসর ছোঁয় না বলে
তাত্ত্বিকভাবে নিরাপদ, কিন্তু টেস্ট শেষে `main`-এ ফিরে আসতে ভুলে গেলে সমস্যা হতে পারে। তাই
**অপশন A সুপারিশ করা হচ্ছে** — সবসময় `main` আলাদা ও অক্ষত থাকে।

যেহেতু `NEXT_PUBLIC_MESSENGER_ENABLED=false` ডিফল্ট, `main`-এ যদি ভুলবশত `messenger` ব্রাঞ্চের
কোড merge ও হয়ে যায় (ভবিষ্যতে), ফ্ল্যাগ অফ থাকা অবস্থায় Messenger এর কোনো UI/রুট দেখা যাবে
না (route handler গুলোও এখন ফ্ল্যাগ চেক করে `/dashboard` এ রিডাইরেক্ট করে দেয়)।

---

## সাধারণ নোট

- প্রতিটা ধাপে নতুন migration ফাইল শুধু লেখা হবে, ইউজার নিজে Supabase এ চালাবেন — কোনো
  ধাপেই আমি নিজে ডাটাবেসে কমান্ড চালাব না।
- WhatsApp এর কোনো worker প্রসেসর/server action/কোয়েরি কখনো এই কাজের জন্য বদলানো হবে না —
  Messenger এর নিজস্ব সমান্তরাল ফাইল/ফাংশন থাকবে (M0 এর `process-inbox-media.ts` vs
  `process-group-media.ts` এর প্যাটার্নে, যেটা এই প্রজেক্টে আগেও ব্যবহার হয়েছে)।
