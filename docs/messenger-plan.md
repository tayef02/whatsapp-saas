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

## M2 — ইনবক্স, AI, অর্ডার, মিডিয়া, Human Agent (সম্পন্ন)

**লক্ষ্য**: কাস্টমার মেসেজ পেলে `messenger_messages` এ সেভ + `tryAiReply()` দিয়ে AI রিপ্লাই,
অর্ডার (channel-aware), ইনকামিং মিডিয়া ডাউনলোড, আর ২৪-ঘণ্টা উইন্ডোর বাইরে Human Agent ট্যাগ
দিয়ে ইনবক্স রিপ্লাই।

### `tryAiReply()` জেনেরিক হলো

`apps/worker/src/processors/process-webhook.ts` এর ভেতরের প্রাইভেট ফাংশন ছিল (M0-M1 পর্যন্ত),
এখন `apps/worker/src/lib/ai-reply.ts` এ এক্সট্র্যাক্ট করা হয়েছে (সাথে `saveOrder`/
`buildOrderContext`/`buildChunkContext`, সবগুলো শুধু `tryAiReply` এর ভেতরেই ব্যবহার হতো)।
WhatsApp আর Messenger দুটোই এখন এটাই import করে।

সিগনেচার: `whatsappNumberId: string | null` আর নতুন `messengerPageId: string | null` — আগের
পরিকল্পনায় (এই ডকের পুরনো সংস্করণে) একটা tagged-union `channel` প্যারামিটার প্রস্তাব করা
হয়েছিল, কিন্তু শেষ পর্যন্ত সহজ nullable-প্যারামিটার পদ্ধতি বেছে নেওয়া হয়েছে — কম
কল-সাইট-পরিবর্তন লাগে, আর channel ফাংশনের ভেতরেই গণনা হয় (`whatsappNumberId ? "whatsapp" :
"messenger"`)। WhatsApp এর দুই কল-সাইটে (গ্রুপ ও ১:১) শুধু `null` যোগ হয়েছে, আচরণ অপরিবর্তিত।

### অর্ডার — `orders.channel`/`messenger_page_id` (migration 0043)

`orders.conversation_id` ফিল্ড শুধু `public.conversations` (WhatsApp) রেফার করে — Messenger
কথোপকথনের id এখানে বসালে FK ভায়োলেশন হতো, তাই **Messenger অর্ডারে `conversation_id` সবসময়
`null`**। কাস্টমার শনাক্ত হয় বিদ্যমান `contact_phone` কলামে psid বসিয়ে (নতুন কলাম ছাড়াই reuse) +
`channel`/`messenger_page_id` দিয়ে। `buildOrderContext()` এখন `channel` দিয়েও ফিল্টার করে, যাতে
একই workspace এ WhatsApp phone আর Messenger psid কখনো একে অপরের অর্ডার-কনটেক্সটে মিশে না যায়।

অর্ডার পেজে চ্যানেল ফিল্টার (সব/WhatsApp/Messenger) + Messenger অর্ডারে পেজ-নাম ব্যাজ যোগ হয়েছে।
অর্ডার status বদলালে (`orders/actions.ts`): Messenger হলে `messenger_conversations` এ
(page_id, psid) দিয়ে খুঁজে ২৪-ঘণ্টা উইন্ডো চেক হয় — **ভেতরে হলে পাঠানো হয়, বাইরে হলে
"বার্তা পাঠানো যায়নি: উইন্ডো শেষ" ওয়ার্নিং দেখানো হয় (toast), কোনো message tag ব্যবহার হয় না**
(POST_PURCHASE_UPDATE ট্যাগ Meta ২০২৬-০২-১০ থেকে বন্ধ হয়ে যাচ্ছে বলে এড়ানো হয়েছে)।

### মিডিয়া

একই `inbox-media` bucket reuse (নতুন bucket/migration লাগেনি), পাথ
`messenger/{workspace_id}/{conversation_id}/{message_id}.{ext}` — WhatsApp এর পাথ থেকে
"messenger/" প্রিফিক্স দিয়ে আলাদা। Graph এর attachment URL এর মেয়াদ ছোট বলে webhook প্রসেসিং এর
সময়ই (job data তে) ধরে রাখা হয়, ডাউনলোড job পরে আবার Graph API কল করে না — সরাসরি
`fetch(url)`। ব্যর্থ হলে শুধু লগ (throw না), মূল মেসেজ (প্লেসহোল্ডার টেক্সট) ততক্ষণে আগেই সেভ
হয়ে থাকে।

**M1 এর একটা বাগও এখানে ধরা পড়ে ঠিক হয়েছে**: Meta এর attachment `type` এ "file" আসে, কিন্তু
`messenger_messages.media_type` কলামের CHECK constraint শুধু "document" মানে — M1 এ সরাসরি
`attachment.type` বসানো হচ্ছিল, যেটা ফাইল attachment এলে insert ব্যর্থ করত।

### Human Agent ট্যাগ — শুধু ইনবক্সের ম্যানুয়াল এজেন্ট রিপ্লাইয়ে

`MessengerReplyJobData` এ নতুন `allowHumanAgentTag: boolean`:
- **ইনবক্স ম্যানুয়াল এজেন্ট রিপ্লাই** (`sendAgentReply`): `true` — ২৪ ঘণ্টা পার হলেও (কাস্টমারের
  সর্বশেষ মেসেজের ৭ দিনের মধ্যে) `MESSAGE_TAG` + `HUMAN_AGENT` ট্যাগ দিয়ে পাঠানোর চেষ্টা হয়,
  ইনবক্সে "Human Agent মোড (৭ দিন পর্যন্ত, প্রোমোশন ছাড়া)" নোট দেখানো হয়। ৭ দিন পার হলে
  রিপ্লাই বক্স বন্ধ হয়ে যায়।
- **AI বট রিপ্লাই আর অর্ডার-স্ট্যাটাস নোটিফিকেশন**: `false` — ২৪ ঘণ্টার উইন্ডো শেষ হলে চুপচাপ
  পাঠানো বন্ধ থাকে, কোনো ট্যাগ ব্যবহার হয় না।

প্রকৃত send-time window-check `process-messenger-reply.ts` এ হয় (caller এর pre-check এর উপর
ভরসা না করে — queue তে backlog থাকলে ততক্ষণে উইন্ডো বদলে যেতে পারে)।

Meta App Review `HUMAN_AGENT` ট্যাগ এখনো approve না করলে Graph API একটা permission/tag-সংক্রান্ত
এরর দেয় — Meta এর exact এরর টেক্সট ডকুমেন্টেড না, তাই heuristic দিয়ে ধরা হয় (Graph এরর কোড
১০, বা মেসেজে "tag"/"permission" শব্দ) আর ধরা পড়লে workspace কে in-app নোটিফিকেশনে বাংলায়
বুঝিয়ে দেওয়া হয় (raw এরর worker লগেও থাকে)। **এই heuristic সঠিক কিনা লাইভে যাচাই করা হয়নি** —
Meta যদি অন্য কোনো টেক্সট দেয়, নোটিফিকেশন নাও আসতে পারে (raw এরর তখনও লগে থাকবে)।

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

### ৭. VPS এ ডিপ্লয় করা (আসল প্রোডাকশন স্ট্যাক, `docker-compose.production.yml`)

আগের সংস্করণে এই সেকশনে একটা হাইপোথেটিক্যাল দ্বিতীয়-ইনস্ট্যান্স সেটআপ লেখা ছিল —
`docker-compose.production.yml`/`apps/web/Dockerfile`/`apps/worker/Dockerfile` আসলে পড়ে
দেখার পর সেটা বাদ দিয়ে নিচের ধাপগুলো বাস্তব সেটআপ অনুযায়ী লেখা হলো। প্রোডাকশন স্ট্যাকে একটাই
`web`/`worker`/`redis` কম্পোজ, Traefik দিয়ে `wa.srv1980546.hstgr.cloud` ডোমেইনে রাউট করা, আর
Evolution API সম্পূর্ণ আলাদা (এই কম্পোজ স্পর্শ করে না)।

**পদ্ধতি**: `messenger` ব্রাঞ্চ সরাসরি এই একই VPS/ডোমেইনে ডিপ্লয় করে ফ্ল্যাগ `true` রেখে টেস্ট
করা হবে (আলাদা সাবডোমেইন/ইনস্ট্যান্স না) — WhatsApp এর কোনো টেবিল/কোড Messenger স্পর্শ করে
না বলে এটা নিরাপদ, আর সমস্যা হলে নিচের রোলব্যাক কমান্ডে সেকেন্ডে `main`-এ ফেরা যায়।

#### ৭.১ `NEXT_PUBLIC_MESSENGER_ENABLED` বিল্ড-টাইমে কীভাবে যায়

`NEXT_PUBLIC_*` ভ্যারিয়েবল Next.js এ **build-time এ client বান্ডেলে বসে যায়** — কন্টেইনার
চালু হওয়ার সময় `env_file` দিয়ে দিলে কাজ করে না (ততক্ষণে বান্ডেল তৈরি হয়ে গেছে)। আর
`.env.production` ইচ্ছাকৃতভাবে `.dockerignore` এ থাকায় (secret leak ঠেকাতে) Docker build
context এও ঢোকে না। তাই এটা `docker-compose.production.yml` থেকে build arg হিসেবে পাস করতে
হয় — এই কাজেই দুইটা ফাইল বদলানো হয়েছে:

- [apps/web/Dockerfile](../apps/web/Dockerfile) এর `builder` স্টেজে, `npm run build` এর আগে
  `ARG NEXT_PUBLIC_MESSENGER_ENABLED` + `ENV NEXT_PUBLIC_MESSENGER_ENABLED=$NEXT_PUBLIC_MESSENGER_ENABLED`
  যোগ হয়েছে।
- [docker-compose.production.yml](../docker-compose.production.yml) এর `web.build` এ
  `args: { NEXT_PUBLIC_MESSENGER_ENABLED: ${NEXT_PUBLIC_MESSENGER_ENABLED:-false} }` যোগ হয়েছে
  — `--env-file .env.production` দিয়ে কম্পোজ চালানো হয় বলে `${...}` ওখান থেকেই রিজলভ হবে।
  ভ্যালু না থাকলে ডিফল্ট `false` (ফ্ল্যাগ বন্ধ) — চুপচাপ `true` ধরে নেওয়া হয় না।

**পাশাপাশি একটা পুরনো, Messenger-অসম্পর্কিত বাগও এই রিভিউতে ধরা পড়লো এবং একই প্যাচে ঠিক করা
হয়েছে**: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` আগে কোনো build arg হিসেবেই
পাস হচ্ছিল না — মানে প্রোডাকশন ইমেজের ব্রাউজার বান্ডেলে এই দুইটা আগে থেকেই `undefined` বসে
যাচ্ছিল, যেটা client-side Supabase ব্যবহার করা অংশে (যেমন লগইন ফর্ম) সমস্যা করতে পারতো। এই
দুইটাও এখন একই ARG/ENV + `build.args` প্যাটার্নে যোগ করা হয়েছে। **এটা যাচাই করতে**: ডিপ্লয়ের
পর ব্রাউজারে DevTools কনসোলে `window.location.reload()` করে লগইন ফর্ম/অন্য client-side
Supabase কল ঠিকমতো কাজ করছে কিনা একবার দেখে নেবেন — আগে এটা কখনো টেস্ট করা না থাকলে এই
ডিপ্লয়েই প্রথমবার সঠিকভাবে কাজ করতে পারে।

#### ৭.২ `.env.production` এ নতুন ভ্যারিয়েবল (নাম, মান নিজে বসাবেন — এখানে ফাইল এডিট করা হয়নি)

```
MESSENGER_APP_ID=
MESSENGER_APP_SECRET=
MESSENGER_WEBHOOK_VERIFY_TOKEN=
MESSENGER_PUBLIC_URL=https://wa.srv1980546.hstgr.cloud
NEXT_PUBLIC_MESSENGER_ENABLED=true
```

`MESSENGER_PUBLIC_URL` এখানে অ্যাপের বিদ্যমান `APP_URL` এর ঠিক একই ডোমেইন (`wa.srv1980546.hstgr.cloud`,
Traefik লেবেলে আগে থেকেই আছে) — কিন্তু আলাদা ভ্যারিয়েবল হিসেবে রাখা হয়েছে কারণ `APP_URL`
ভবিষ্যতে docker-internal/অন্য মান নিতে পারে (WhatsApp/Evolution এর জন্য), `MESSENGER_PUBLIC_URL`
সবসময় পাবলিক https ডোমেইন থাকতে হবে এই গ্যারান্টি রাখতে।

**worker এর আসলে কী লাগে**: `MESSENGER_APP_ID`/`MESSENGER_APP_SECRET` শুধু (রিপ্লাই পাঠাতে ও
কাস্টমার নাম আনতে) — `MESSENGER_PUBLIC_URL`/`MESSENGER_WEBHOOK_VERIFY_TOKEN`/
`NEXT_PUBLIC_MESSENGER_ENABLED` শুধু `web` ব্যবহার করে। যেহেতু দুটো সার্ভিসই একই
`.env.production` ফাইল `env_file:` দিয়ে পুরোটা লোড করে, আলাদা করে ভাগ করার দরকার নেই — সব
ভ্যারিয়েবল দুই কন্টেইনারেই যাবে, অপ্রয়োজনীয়গুলো শুধু ব্যবহার হবে না।

**যাচাই করা হয়েছে — flag বন্ধ বা env না থাকলে worker ক্র্যাশ করে না**:
[process-messenger-reply.ts](../apps/worker/src/processors/process-messenger-reply.ts) ও
[process-messenger-webhook.ts](../apps/worker/src/processors/process-messenger-webhook.ts)
দুটোই `MESSENGER_APP_ID`/`SECRET` না পেলে `console.error` লিখে নিরাপদে রিটার্ন করে (throw
করে না), আর `apps/worker/src/index.ts` এর `messengerWebhookWorker`/`messengerJobsWorker`
শুধু Redis কানেকশন লাগে চালু হতে — এই দুইটা env var এর উপর নির্ভর করে না। তাই
`NEXT_PUBLIC_MESSENGER_ENABLED=false` রাখলেও, বা Messenger env var গুলো একেবারে না বসালেও,
WhatsApp এর worker queue (webhook, campaign-send, chatbot-autoreply ইত্যাদি) স্বাভাবিকভাবে
চলতে থাকবে — কোনো কোড পরিবর্তন লাগেনি, এটা আগে থেকেই নিরাপদভাবে লেখা ছিল।

#### ৭.৩ ডিপ্লয় কমান্ড (VPS এ, রিপোর রুট থেকে)

```bash
git fetch origin
git checkout messenger
git pull origin messenger
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build web worker
```

শেষ লাইনে স্পষ্ট করে `web worker` বলায় শুধু এই দুইটা সার্ভিস রিবিল্ড/রিস্টার্ট হবে — `redis`
অক্ষত থাকবে (রিস্টার্ট হবে না বলে BullMQ এর ইন-ফ্লাইট job হারাবে না)। Evolution API এই কম্পোজে
নেই বলে এমনিতেই অপ্রভাবিত।

#### ৭.৪ রোলব্যাক কমান্ড

```bash
git checkout main
git pull origin main
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build web worker
```

⚠️ এই দুই কমান্ডের আগে `git status` দেখে নেওয়া ভালো — VPS এ কোনো আনকমিটেড পরিবর্তন (যেমন
ম্যানুয়াল হটফিক্স) থাকলে ব্রাঞ্চ বদলানোর আগে সেটা `git stash` করে রাখা, নাহলে checkout আটকে
যেতে পারে বা পরিবর্তন হারাতে পারে।

#### ৭.৫ Meta App এ তিন জায়গায় কী বসবে (স্থায়ী ডোমেইন দিয়ে)

| জায়গা | মান |
|---|---|
| App Domains (Settings → Basic) | `wa.srv1980546.hstgr.cloud` |
| Valid OAuth Redirect URI (Facebook Login for Business → Settings) | `https://wa.srv1980546.hstgr.cloud/dashboard/messenger/connect/callback` |
| Webhook Callback URL (Messenger → Settings → Webhooks) | `https://wa.srv1980546.hstgr.cloud/api/webhooks/messenger`, Verify Token = `.env.production`-এর `MESSENGER_WEBHOOK_VERIFY_TOKEN` এর ঠিক একই মান |

এই ধাপের পর "পুরো ফ্লো টেস্ট" (উপরের ধাপ ৬) ঠিক একইভাবে করবেন, শুধু dev সার্ভার/টানেলের বদলে
সরাসরি `https://wa.srv1980546.hstgr.cloud` এ।

---

<details>
<summary>আগের টানেল-ভিত্তিক লোকাল টেস্ট ধাপ (ধাপ ৪-৫, এখনো বৈধ — শুধু VPS টেস্টের বদলে দ্রুত
লোকাল আইটারেশনের জন্য প্রাসঙ্গিক এখন)</summary>

ধাপ ৪-৫ (ngrok/cloudflared টানেল) উপরেই আছে, অপরিবর্তিত। VPS এ টেস্ট করলে ওই ধাপ লাগবে না।

</details>

যেহেতু `NEXT_PUBLIC_MESSENGER_ENABLED=false` ডিফল্ট, `main`-এ যদি ভুলবশত `messenger` ব্রাঞ্চের
কোড merge ও হয়ে যায় (ভবিষ্যতে), ফ্ল্যাগ অফ থাকা অবস্থায় Messenger এর কোনো UI/রুট দেখা যাবে
না (route handler গুলোও এখন ফ্ল্যাগ চেক করে `/dashboard` এ রিডাইরেক্ট করে দেয়)।

---

## M2 টেস্ট করার ধাপ

### ১. Migration চালানোর ক্রম

M1 এর ৩টার (0040→0041→0042) পরে শুধু একটা নতুন:

4. `0043_orders_channel.sql`

⚠️ `orders` লাইভ টেবিল — কম-ট্রাফিকের সময় চালানোর পরামর্শ (migration ফাইলের কমেন্টেও লেখা
আছে)। দুটো কলামই additive/DEFAULT-সহ, তাই দ্রুত শেষ হওয়ার কথা।

### ২. AI রিপ্লাই টেস্ট

1. Messenger পেজে "বট চালু" আছে কিনা `/dashboard/messenger` এ চেক করুন (ডিফল্ট চালু থাকে)।
2. AI Chatbot সেটিংস (`/dashboard/ai-chatbot`) এ LLM provider/API key/system prompt সেট করা
   আছে কিনা দেখুন — এটা WhatsApp আর Messenger দুই চ্যানেলেই শেয়ার্ড, আলাদা করে কিছু বসাতে হবে না।
3. পেজে একটা মেসেজ পাঠান, কয়েক সেকেন্ডের মধ্যে AI রিপ্লাই আসা উচিত। worker এর লগে
   `[messenger-webhook]`/`[messenger-reply]` প্রিফিক্সের লাইন দেখুন।
4. এমন একটা প্রশ্ন করুন যেটার উত্তর knowledge base এ নেই — কথোপকথন `handed_off` হয়ে যাওয়া
   উচিত (ইনবক্সে ব্যাজ দেখুন), আর dashboard এ একটা নোটিফিকেশন আসা উচিত।
5. "বট বন্ধ" করে আবার একটা মেসেজ পাঠান — কোনো রিপ্লাই আসা উচিত না (মেসেজও সেভ হবে না, এটা
   WhatsApp এর bot_enabled বন্ধ থাকলে একই আচরণ — ইচ্ছাকৃত, docs/messenger-plan.md এর M2
   সেকশনে কারণ লেখা আছে)।

### ৩. অর্ডার টেস্ট

1. চ্যাটবটের সাথে কথা বলে একটা অর্ডার কনফার্ম করুন (system prompt এ অর্ডার নেওয়ার নির্দেশ
   থাকতে হবে — WhatsApp এর AI Chatbot সেটিংসেই লেখা, শেয়ার্ড)।
2. `/dashboard/orders` এ অর্ডারটা দেখা উচিত, "Messenger" ব্যাজ + পেজের নাম সহ। চ্যানেল
   ফিল্টার দিয়ে শুধু Messenger অর্ডার আলাদা করে দেখুন।
3. স্ট্যাটাস বদলান (যেমন pending → confirmed) — কাস্টমারকে Messenger এ একটা আপডেট মেসেজ
   যাওয়া উচিত (২৪ ঘণ্টার মধ্যে মেসেজ করা থাকলে)।
4. উইন্ডো-শেষ কেস টেস্ট করতে: Supabase SQL Editor এ ম্যানুয়ালি
   `update messenger_conversations set last_user_message_at = now() - interval '2 days' where id = '...'`
   চালিয়ে তারপর স্ট্যাটাস বদলান — "বার্তা পাঠানো যায়নি: উইন্ডো শেষ" ওয়ার্নিং (toast) আসা উচিত,
   কোনো মেসেজ না গিয়ে।

### ৪. মিডিয়া টেস্ট

1. পেজে একটা ছবি পাঠান — কয়েক সেকেন্ডের মধ্যে ইনবক্সে থাম্বনেইল আসা উচিত (প্রথমে
   "ডাউনলোড হচ্ছে..." দেখাবে, তারপর রিফ্রেশে/কয়েক সেকেন্ড পর ছবি)।
2. থাম্বনেইলে ক্লিক করে বড় করে দেখুন (lightbox)।
3. একটা PDF/ভিডিও/অডিও পাঠিয়ে ডকুমেন্ট/ভিডিও/অডিও আইকন + "ডাউনলোড" লিংক কাজ করে কিনা দেখুন।

### ৫. Human Agent মোড টেস্ট (৭ দিন অপেক্ষা না করে)

Supabase SQL Editor এ ম্যানুয়ালি একটা কথোপকথনের `last_user_message_at` ২৪ ঘণ্টার বেশি পেছনে
সরিয়ে দিন (উপরের অর্ডার টেস্টের কমান্ডের মতোই), তারপর:

1. ইনবক্সে সেই কথোপকথনে যান — ব্যাজে "Human Agent: X দিন বাকি" দেখা উচিত, রিপ্লাই বক্স খোলা
   থাকা উচিত (বন্ধ না), আর একটা হলুদ নোট "Human Agent মোড..." দেখা উচিত।
2. একটা রিপ্লাই পাঠান। দুটো সম্ভাবনা:
   - **Meta App Review এ `HUMAN_AGENT` ট্যাগ অনুমোদিত থাকলে**: রিপ্লাই পৌঁছাবে।
   - **অনুমোদিত না থাকলে** (Development mode এ বেশিরভাগ সময় এটাই হবে): পাঠানো ব্যর্থ হবে,
     dashboard এ "Messenger এ রিপ্লাই পাঠানো যায়নি" নোটিফিকেশন আসা উচিত বাংলা ব্যাখ্যাসহ।
     worker লগে `tagError=true` দেখুন।
3. `last_user_message_at` আরও পেছনে (৮ দিন+) সরিয়ে আবার চেক করুন — এবার রিপ্লাই বক্স বন্ধ
   হয়ে যাওয়া উচিত।

---

## সাধারণ নোট

- প্রতিটা ধাপে নতুন migration ফাইল শুধু লেখা হবে, ইউজার নিজে Supabase এ চালাবেন — কোনো
  ধাপেই আমি নিজে ডাটাবেসে কমান্ড চালাব না।
- WhatsApp এর কোনো worker প্রসেসর/server action/কোয়েরি কখনো এই কাজের জন্য বদলানো হবে না —
  Messenger এর নিজস্ব সমান্তরাল ফাইল/ফাংশন থাকবে (M0 এর `process-inbox-media.ts` vs
  `process-group-media.ts` এর প্যাটার্নে, যেটা এই প্রজেক্টে আগেও ব্যবহার হয়েছে)।
