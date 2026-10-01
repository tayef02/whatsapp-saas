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

## M3 — কমেন্ট অটোমেশন (সম্পন্ন)

**লক্ষ্য**: পোস্টের কমেন্টে কিওয়ার্ড/AI দিয়ে অটো-রিপ্লাই (WhatsApp গ্রুপ কিওয়ার্ড রিপ্লাই
ফিচারের সমান্তরাল), কমেন্ট থেকে লিড ক্যাপচার, Private Reply দিয়ে ইনবক্সে কথোপকথন শুরু।

*(নোট: `orders.channel`/`messenger_page_id` মূল পরিকল্পনায় এই ধাপে করার কথা ছিল, বাস্তবে
সেটা M2 তেই আগে হয়ে গেছে — উপরের M2 সেকশন দেখুন।)*

**দরকারি Meta পারমিশন** ([Pages API ডকুমেন্টেশন](https://developers.facebook.com/documentation/pages-api)):
- `pages_manage_engagement` — কমেন্টে রিপ্লাই করতে (এই ধাপে ব্যবহার শুরু হলো; হাইড/ডিলিট M5 তে)
- `pages_read_engagement` — webhook দিয়ে কমেন্ট ইভেন্ট পেতে (M1 থেকেই OAuth scope এ ছিল)
- webhook `feed` field — নতুন কমেন্ট রিয়েল-টাইমে পেতে

⚠️ এই permission সেট Meta এর বর্তমান ডকুমেন্টেশনের সাথে মিলিয়ে App Review submission এর
আগে একবার যাচাই করে নেওয়া ভালো — `pages_read_user_content` লাগবে কিনা নিশ্চিতভাবে জানা
নেই (এখানে যোগ করা হয়নি)।

### কী বানানো হলো

- **নতুন টেবিল** (migration 0047): `messenger_comment_rules` (WhatsApp গ্রুপের
  `group_keyword_replies` এর হুবহু কাঠামো — trigger_type/reply_mode/cooldown_seconds/
  last_triggered_at, atomic cooldown চেক একই single-UPDATE প্যাটার্নে; নতুন `action` কলাম
  `public_reply`/`private_reply`, "নিবো/ইনবক্স" জাতীয় কিওয়ার্ডও তাই কোড-হার্ডকোডেড না, সাধারণ
  রুল হিসেবেই ম্যানেজ করা যায়) আর `messenger_comments` (প্রতিটা কমেন্টের লগ, `comment_id`
  দিয়ে dedup, লিড ফ্ল্যাগ `is_lead`/`lead_phone` এই রো-তেই — আলাদা টেবিল লাগেনি)।
- **Webhook**: `/api/webhooks/messenger/route.ts` এখন `entry[].messaging[]` (DM, M1-M2)
  আর `entry[].changes[]` (feed/কমেন্ট, M3) দুটোই পড়ে — কমেন্ট শুধু `item="comment"
  verb="add"` হলে প্রসেস হয় (এডিট/রিমুভ/রিঅ্যাকশন এই ধাপে হ্যান্ডল হয় না)। একই
  `messenger-webhook-events` queue তে নতুন job name `"comment"` (DM এর `"event"` থেকে আলাদা)।
- **webhook সাবস্ক্রিপশন**: `subscribePageWebhook()` এ `subscribed_fields` এ `"feed"` যোগ
  হয়েছে। নতুন কানেক্ট হওয়া পেজে এমনিতেই পাবে, আগে কানেক্ট হওয়া পেজে
  `/dashboard/messenger` এর PageCard এ নতুন **"ওয়েবহুক রিফ্রেশ করুন"** বাটন চাপতে হবে
  (WhatsApp Groups পেজের একই প্যাটার্ন)।
- **ম্যাচিং + রিপ্লাই**: `process-messenger-comment.ts` — প্রতিটা কমেন্ট সবসময় লগ হয়
  (bot_enabled যাই হোক, WhatsApp bot_enabled ফিক্সের একই নীতি), ফোন নাম্বার মিললে লিড +
  নোটিফিকেশন (bot_enabled নির্বিশেষে)। বট চালু থাকলে active rule ম্যাচ (keyword সাবস্ট্রিং বা
  "সব কমেন্ট"), atomic cooldown। ফিক্সড মোডে বিদ্যমান **spintax engine**
  (`resolveSpintax()`, WhatsApp টেমপ্লেটের একই ইউটিলিটি, কোনো পরিবর্তন ছাড়াই reuse) দিয়ে
  বৈচিত্র্য — একই রুল বারবার ম্যাচ করলেও হুবহু একই টেক্সট যায় না (স্প্যাম-ঝুঁকি কমাতে)।
- **AI মোড কমেন্টের জন্য আলাদা, সরলীকৃত ফাংশন** (`apps/worker/src/lib/comment-ai-reply.ts`,
  `tryAiReply()` থেকে ইচ্ছাকৃতভাবে আলাদা) — Messenger এর নিজস্ব AI সেটিংস/নলেজ বেস (M2 তে
  বানানো `messenger_ai_settings`) ব্যবহার করে কিন্তু কোনো history/অর্ডার-ব্লক পার্সিং নেই
  (পাবলিক কমেন্টে ভুলবশত অর্ডার সেভ হয়ে যাওয়া বা "needs_human" মার্কার-টেক্সট পাবলিকলি পোস্ট
  হয়ে যাওয়া এড়াতে) — অনিশ্চিত হলে চুপচাপ রিপ্লাই স্কিপ করে, পাবলিকলি কিছু বলে না।
- **রিপ্লাই পাঠানো**: `process-messenger-comment-reply.ts` (`messenger-jobs` queue তে নতুন
  job name `"comment-reply"`) — `public_reply` হলে `{comment-id}/comments` এ POST,
  `private_reply` হলে Messenger Private Reply API (`recipient.comment_id`, Meta এর
  ডকুমেন্টেড পদ্ধতি — ⚠️ লাইভে প্রথমবার টেস্ট করার সময় endpoint/shape যাচাই করে নেওয়া ভালো,
  Meta এর ডকুমেন্টেশন হাতে রেখে)। Private Reply সফল হলে `messenger_conversations`/
  `messenger_messages` এ স্বাভাবিক কথোপকথনের মতোই সেভ হয়, ইনবক্সে দেখা যায়। Meta এর "প্রতি
  কমেন্টে একবারই" নিয়ম আলাদা কোনো চেক ছাড়াই পূরণ হয় — `comment_id` dedup মানেই প্রতিটা কমেন্ট
  জীবনে একবারই প্রসেস হয়।
- **ড্যাশবোর্ড পেজ** `/dashboard/messenger/comments`: একাধিক পেজ কানেক্ট থাকলে পেজ-সিলেক্টর
  ট্যাব, রুল যোগ/চালু-বন্ধ/মুছে ফেলা, সাম্প্রতিক ৫০টা কমেন্টের লগ টেবিল (লিড ব্যাজসহ)।

### জানা সীমাবদ্ধতা

- Private Reply API এর ঠিক endpoint/payload shape কখনো লাইভে টেস্ট করা হয়নি — Meta এর
  ডকুমেন্টেশন অনুযায়ী লেখা, প্রথম টেস্টে ব্যর্থ হলে `packages/core/providers/messenger.ts`
  এর `sendPrivateReply()` ঠিক করা লাগতে পারে।
- AI মোডে কমেন্ট রিপ্লাইয়ে কোনো history নেই (প্রতিটা কমেন্ট স্বতন্ত্র প্রশ্ন ধরা হয়) আর বড়
  knowledge base হলে chunk-retrieval মোড নেই (শুধু ছোট/মাঝারি KB, full-text মোডে) — স্কোপ
  ইচ্ছাকৃতভাবে ছোট রাখা হয়েছে।
- OAuth scope এ `pages_manage_engagement` এখন যোগ হয়েছে, কিন্তু বিদ্যমান কানেক্টেড পেজের
  token এই নতুন permission সহ আপডেট হয়নি — কমেন্ট রিপ্লাই কাজ না করলে পেজ **আবার কানেক্ট**
  করা লাগতে পারে (শুধু webhook রিফ্রেশ যথেষ্ট না হতে পারে, কারণ permission scope token এর
  সাথে বাঁধা, webhook subscription এর সাথে না)।

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

## M3 টেস্ট করার ধাপ

### ১. Migration চালানোর ক্রম

M1-M2 এর ৪টার (0040→0043) পরে শুধু একটা নতুন:

5. `0047_messenger_comments.sql`

নতুন টেবিল তৈরি করে শুধু (`messenger_comment_rules`, `messenger_comments`), কোনো বিদ্যমান
টেবিল টাচ করে না — ঝুঁকি কম, যেকোনো সময় চালানো যায়।

### ২. Webhook "feed" সাবস্ক্রিপশন চেক

1. **নতুন পেজ কানেক্ট করলে**: এমনিতেই `feed` field সহ সাবস্ক্রাইব হবে, আলাদা কিছু করার নেই।
2. **আগে থেকে কানেক্টেড পেজে**: `/dashboard/messenger` এ সেই পেজের কার্ডে "ওয়েবহুক ইভেন্ট
   রিফ্রেশ করুন" বাটন চাপুন (Groups পেজের একই বাটনের প্যাটার্ন)। সফল হলে toast দেখা উচিত।
3. ⚠️ যদি webhook রিফ্রেশের পরও কমেন্ট ইভেন্ট না আসে: OAuth scope এ `pages_manage_engagement`
   নতুন যোগ হয়েছে, কিন্তু বিদ্যমান পেজের token পুরনো scope দিয়ে ইস্যু করা — পেজটা
   **ডিসকানেক্ট করে আবার কানেক্ট** করে দেখুন (নতুন permission consent সহ)।

### ৩. পাবলিক রিপ্লাই রুল টেস্ট

1. `/dashboard/messenger/comments` এ যান, একটা কিওয়ার্ড রুল বানান (যেমন কিওয়ার্ড "দাম",
   অ্যাকশন "পাবলিক রিপ্লাই", মোড "ফিক্সড", টেক্সট `{ধন্যবাদ|থ্যাংকস}! দাম {৫০০|৫০০ টাকা} টাকা`)।
2. পেজের কোনো পোস্টে "দাম কত?" লিখে কমেন্ট করুন (অন্য কোনো Facebook অ্যাকাউন্ট থেকে — নিজের
   পেজ-অ্যাডমিন অ্যাকাউন্ট দিয়ে কমেন্ট করলে webhook আসে না, এটা Meta এর নিজস্ব সীমাবদ্ধতা)।
3. কয়েক সেকেন্ডের মধ্যে কমেন্টের নিচে পাবলিক রিপ্লাই আসা উচিত (প্রতিবার স্পিনট্যাক্স ভিন্নতা
   সহ — "ধন্যবাদ"/"থ্যাংকস" পালাক্রমে)। worker লগে `[messenger-comment]` প্রিফিক্সের লাইন দেখুন।
4. একই রুলে আবার কমেন্ট করুন কিন্তু cooldown এর মধ্যেই — এবার রিপ্লাই যাওয়া উচিত না
   (`/dashboard/messenger/comments` এর লগ টেবিলে কমেন্ট দেখা যাবে, কিন্তু "রিপ্লাই যায়নি")।

### ৪. Private Reply টেস্ট

1. একটা রুল বানান অ্যাকশন "ইনবক্সে Private Reply পাঠান" দিয়ে।
2. ম্যাচিং কমেন্ট করুন — সফল হলে Messenger ইনবক্সে (`/dashboard/messenger/inbox`) একটা নতুন
   কথোপকথন তৈরি হওয়া উচিত।
3. ⚠️ এই endpoint কখনো লাইভে টেস্ট করা হয়নি — ব্যর্থ হলে worker লগে এরর মেসেজ দেখুন, Meta এর
   Private Reply ডকুমেন্টেশনের সাথে মিলিয়ে `packages/core/providers/messenger.ts`-এর
   `sendPrivateReply()` ঠিক করা লাগতে পারে।

### ৫. AI মোড টেস্ট

1. একটা রুল বানান রিপ্লাই মোড "AI দিয়ে উত্তর" দিয়ে, trigger "এই পেজের সব নতুন কমেন্ট"।
2. বিভিন্ন ধরনের কমেন্ট করে দেখুন — knowledge base এ উত্তর থাকলে রিপ্লাই আসা উচিত, না থাকলে
   চুপচাপ স্কিপ (কোনো "জানি না" জাতীয় টেক্সট পাবলিকলি পোস্ট হবে না — এটা ইচ্ছাকৃত)।

### ৬. লিড ক্যাপচার টেস্ট

1. কোনো রুলে না মিলিয়ে শুধু একটা ফোন নাম্বার লিখে কমেন্ট করুন (যেমন "01712345678 তে কল করবেন")।
2. `/dashboard/messenger/comments` এর লগ টেবিলে কমেন্টটা "লিড" ব্যাজ + নরমালাইজড নাম্বার সহ
   দেখা উচিত, আর dashboard এ "কমেন্টে নতুন লিড" নোটিফিকেশন আসা উচিত (bot বন্ধ থাকলেও আসবে —
   লিড-ডিটেকশন bot_enabled এর উপর নির্ভর করে না, ইচ্ছাকৃতভাবে)।

### ৭. টেস্ট স্ক্রিপ্ট দিয়ে যাচাই (আসল Facebook কমেন্ট ছাড়াই)

আসল পোস্টে আসল Facebook অ্যাকাউন্ট দিয়ে কমেন্ট করা ঝামেলার হতে পারে (অ্যাডমিন অ্যাকাউন্ট
দিয়ে কমেন্ট করলে webhook আসে না, আলাদা টেস্ট অ্যাকাউন্ট লাগে)। `scripts/test-messenger-comment.ts`
স্ক্রিপ্টটা Meta-র "feed" webhook ইভেন্টের ঠিক একই আকারের একটা নকল payload বানিয়ে, আসল
`MESSENGER_APP_SECRET` দিয়ে sign করে, সরাসরি `/api/webhooks/messenger` এ POST করে — এতে
signature যাচাই, রুল-ম্যাচিং, লগ লেখা, আর queue/worker পাইপলাইন পরীক্ষা হয়ে যায়।

**চালানোর আগে**: Redis (`docker-compose up -d redis`) আর worker (`npm run dev:worker`) চালু
থাকতে হবে — নাহলে BullMQ queue.add() Redis এর সাথে কানেক্ট করার চেষ্টায় রিট্রাই করতে থাকবে
আর রিকোয়েস্ট অনেকক্ষণ ঝুলে থাকতে পারে (তবু শেষে হয়তো 200 ফেরত দেবে)। web dev server
(`npm run dev:web`) ও চালু থাকতে হবে, যেহেতু স্ক্রিপ্ট ডিফল্টভাবে `http://localhost:3000` এ POST করে।

```bash
npx tsx scripts/test-messenger-comment.ts <page_id> "দাম কত?"
```

- `page_id` — কোনো কানেক্টেড পেজের আসল Facebook page_id (Supabase এ `messenger_pages.page_id`
  কলামে দেখুন) — worker এটা দিয়েই workspace/সেটিংস লুকআপ করে, তাই আসল হতে হবে।
  comment_id/post_id/from (কমেন্টকারীর psid) স্ক্রিপ্ট নিজেই নকল তৈরি করে।
- কমেন্টের লেখায় একটা ফোন নাম্বার দিলে (`"দাম কত? 01712345678"`) লিড ক্যাপচার টেস্ট হয়ে যায়।
- secret (ডিফল্টে `apps/web/.env.local` থেকে পড়া হয়), payload, আর টার্গেট URL এর কোনো
  কোয়েরি-স্ট্রিং কখনো কনসোলে প্রিন্ট হয় না — শুধু HTTP status আর একটা ছোট ব্যাখ্যা লাইন দেখায়।

**যা আশা করবেন** (লোকালে চালালে):
- HTTP status `200` — webhook রুট ইভেন্টটা queue তে বসিয়েছে।
- worker এর লগে `[messenger-comment]` প্রিফিক্সের লাইন — কমেন্ট সেভ হওয়া, রুল ম্যাচ/না-ম্যাচ,
  cooldown, রিপ্লাই জব queue হওয়া দেখাবে।
- `/dashboard/messenger/comments` এর লগ টেবিলে নতুন রো দেখা উচিত।
- রিপ্লাই জব (public_reply/private_reply) **ব্যর্থ হবে** — কারণ `comment_id`/`fromPsid` নকল,
  Meta এর আসল API এই আইডি চিনবে না। worker এর `[messenger-comment-reply]` লগে একটা Meta API
  এরর (যেমন "Unsupported comment" বা অনুরূপ) দেখা **স্বাভাবিক ও প্রত্যাশিত** — এটা পাইপলাইনের
  বাগ না, শুধু নকল ডাটার সীমাবদ্ধতা। রুল-ম্যাচিং/লগ/queue পর্যন্ত কাজ করলেই স্ক্রিপ্টের উদ্দেশ্য
  পূরণ হয়েছে ধরা যায়।
- signature ভুল হলে (secret মিলছে না) `401` আসবে।

### ৮. প্রোডাকশনে (VPS) চালানো

একই স্ক্রিপ্ট `--url` ফ্ল্যাগ দিয়ে লাইভ সার্ভারেও চালানো যায় — তখন webhook রুট আসল
`wa-worker` কন্টেইনারে চলা worker-কে ইভেন্টটা দেয়, লোকাল worker লাগে না।

```bash
npx tsx scripts/test-messenger-comment.ts <page_id> "দাম কত?" --url https://wa.srv1980546.hstgr.cloud
```

- `--url` এ শুধু origin (উপরের উদাহরণের মতো) দিলেই চলবে — webhook পাথ (`/api/webhooks/messenger`)
  স্ক্রিপ্ট নিজেই যুক্ত করে নেয়। সম্পূর্ণ পাথ দিলেও কাজ করবে।
- secret সবসময় **আপনার লোকাল মেশিনের** `apps/web/.env.local` থেকে পড়া হয় (production সার্ভারে
  কোনো রিকোয়েস্ট যায় না secret আনার জন্য) — তাই লোকাল `.env.local` এ ঠিক সেই Meta App এর
  `MESSENGER_APP_SECRET` থাকতে হবে যেটা production এও ব্যবহার হচ্ছে (সাধারণত একই, কারণ app secret
  Meta App এর সাথে বাঁধা, deployment environment এর সাথে না)। আলাদা ফাইলে রাখলে
  `--env-path <path>` দিয়ে দেখিয়ে দিন, যেমন `--env-path ./production-secret.env.local`।
  (ফ্ল্যাগের নাম ইচ্ছাকৃতভাবে `--env-file` না — `tsx` নিজেই `--env-file` কে node এর built-in
  env-loader ফ্ল্যাগ হিসেবে intercept করে script এর কাছে পৌঁছানোর আগেই, তাই নাম সংঘর্ষ এড়াতে
  `--env-path` রাখা হয়েছে।)

**VPS তে কী আশা করবেন**:

```bash
docker logs -f wa-worker
```

- `[messenger-comment]` প্রিফিক্সের লাইন — কমেন্ট লগ হওয়া, রুল ম্যাচ/cooldown/না-ম্যাচ।
- লিড ফোন নাম্বার দিলে dashboard এ "কমেন্টে নতুন লিড" নোটিফিকেশন তৈরি হওয়ার লগ।
- রুল ম্যাচ করলে `[messenger-comment-reply]` প্রিফিক্সে একটা Meta API এরর — নকল `comment_id`
  বলে এটাই প্রত্যাশিত, worker/queue ক্রাশ করছে না এটাই আসল পরীক্ষার বিষয়।
- ⚠️ যদি webhook থেকে কোনো লগই না আসে: webhook route টা আসলে request পেয়েছে কিনা Nginx/`wa-web`
  এর লগে (`docker logs wa-web`) `POST /api/webhooks/messenger` লাইন খুঁজুন — না পেলে ডোমেইন/SSL/
  Nginx proxy কনফিগারেশন সমস্যা, worker এর কোড না।

---

# চ্যানেল বিচ্ছিন্নতা ("ফেজ" সিরিজ — M0-M5 এর উপরে আলাদা একটা বড় উদ্যোগ)

M0-M2 এ Messenger এর বেশিরভাগ ফিচার তৈরি হয়ে গেছে, কিন্তু অর্ডার/ড্যাশবোর্ড/নোটিফিকেশন/AI
চ্যাটবট কয়েক জায়গায় WhatsApp এর সাথে শেয়ার্ড/মিশে ছিল — এই ফেজ সিরিজ (ফেজ ১-৬) সেটা
ঠিক করছে: **প্রতিটা চ্যানেল সম্পূর্ণ আলাদা সেকশন, শুধু অ্যাকাউন্ট-লেভেল (লগইন/workspace/
প্ল্যান/বিলিং/পেমেন্ট/সেটিংস/অ্যাডমিন) শেয়ার্ড** — নিয়মটা `CLAUDE.md`-এর "চ্যানেল বিচ্ছিন্নতা"
সেকশনে স্থায়ীভাবে লেখা আছে।

## ফেজ ১ — WhatsApp ও Messenger সম্পূর্ণ আলাদা সেকশন (সম্পন্ন)

### অডিটে যা পাওয়া গিয়েছিল

- **অর্ডার**: `orders.channel` কলাম আগে থেকেই ছিল (M3 খসড়ায় যোগ) কিন্তু `/dashboard/orders`
  এর কোয়েরিতে ফিল্টার করা হতো না — দুই চ্যানেলের অর্ডার একসাথে লোড হয়ে শুধু client-side
  ড্রপডাউন দিয়ে আলাদা দেখানো হতো।
- **ড্যাশবোর্ড**: "সব" ট্যাব আসলে কোনো cross-channel aggregation করত না — WhatsApp ট্যাবের
  হুবহু একই কোড চালাত। pending-orders কাউন্টে channel ফিল্টার ছিল না (Messenger এর pending
  অর্ডারও WhatsApp ড্যাশবোর্ডে গোনা হতো)।
- **নোটিফিকেশন**: `notifications` টেবিলে channel কলাম ছিল না — কোনটা কোন চ্যানেলের তা শুধু
  title এর বাংলা টেক্সট পড়ে বোঝা যেত।
- **AI চ্যাটবট ও নলেজ বেস**: `workspace_ai_settings`/`knowledge_base_documents` সম্পূর্ণ
  workspace-ভিত্তিক, কোনো channel ধারণাই ছিল না — Messenger এর পেজ শুধু WhatsApp এর
  সেটিংস পেজে রিডাইরেক্ট করত।
- **প্ল্যান ব্যবহারের হিসাব (নতুন গুরুত্বপূর্ণ finding)**: `messages_used_this_cycle` শুধু
  WhatsApp ক্যাম্পেইন/ওয়েবহুক কোড (`apply_message_status` RPC) ইনক্রিমেন্ট করে —
  **Messenger এর কোনো মেসেজ-সেন্ড এখনো এই কোটায় গোনা হয় না**, বিলিং পেজ তাই Messenger এর
  ট্রাফিক বাদ দিয়ে সংখ্যা দেখায়। এই ফেজে এটা শুধু ডকুমেন্ট করা হয়েছে (হিসাব বদলানো হয়নি,
  ইউজার এটাই চেয়েছেন) — ভবিষ্যতে এটা ঠিক করতে হলে `apply_message_status` এর ধাঁচের একটা
  Messenger-ভার্সন RPC বা worker-সাইড কাউন্টার লাগবে, আলাদা আলোচনা দরকার।
- **nav-config.ts**: `Channel` টাইপ আর `getNavGroups()`/`getChannelFromPathname()` hardcoded
  ternary ছিল — নতুন চ্যানেল যোগ করতে এই ফাংশনগুলোর ভেতরের লজিক এডিট করা লাগত।

### কী বদলেছে

1. **অর্ডার**: `/dashboard/orders` এখন শুধু `channel='whatsapp'` (filter/badge UI সরানো
   হয়েছে)। নতুন `/dashboard/messenger/orders` শুধু `channel='messenger'` (একই `OrdersList`
   কম্পোনেন্ট reuse, `channel` প্রপ দিয়ে)। `updateOrderStatus`/`getOrderHistory`
   (`apps/web/app/dashboard/orders/actions.ts`) ইচ্ছাকৃতভাবে শেয়ার্ড রাখা হয়েছে — এগুলো
   ইতিমধ্যে `order.channel` পড়ে সঠিক queue (WhatsApp/Messenger) বাছে, ডুপ্লিকেট করলে দুই
   জায়গায় লজিক আলাদা হয়ে যাওয়ার (ড্রিফট) ঝুঁকি বাড়ত।
2. **ড্যাশবোর্ড**: "সব" ট্যাব সরানো হয়েছে, শুধু WhatsApp/Messenger দুই ট্যাব। Messenger
   ট্যাব এখন WhatsApp এর সমমানের — ৪টা স্ট্যাট কার্ড (কানেক্টেড পেজ/কথোপকথন/আজকের মেসেজ/
   এজেন্ট দরকার), ৭-দিনের ইনবাউন্ড-vs-আউটবাউন্ড চার্ট, সাম্প্রতিক কার্যক্রম (হ্যান্ডঅফ
   কথোপকথন + pending অর্ডার)। "প্ল্যান ব্যবহার" কার্ড এখন ট্যাবের বাইরে (অ্যাকাউন্ট-লেভেল
   কোয়েরি, একবারই চলে, দুই ট্যাবেই অভিন্ন দেখায়)। WhatsApp ট্যাবের pending-orders কাউন্টে
   `channel='whatsapp'` ফিল্টার যোগ হয়েছে।
3. **নোটিফিকেশন**: `notifications.channel` কলাম (migration 0044, nullable — null মানে
   অ্যাকাউন্ট-লেভেল/চ্যানেল-নিরপেক্ষ, যেমন প্ল্যান মেয়াদ শেষের অ্যালার্ট)। `createNotification()`
   এর সিগনেচার বদলেছে — `channel` এখন বাধ্যতামূলক প্যারামিটার (optional না, যাতে কম্পাইলার
   প্রতিটা কল-সাইটে ভুলে বাদ পড়া ধরে ফেলে): `createNotification(workspaceId, type, title,
   channel, body?)`। সব ১৩টা কল-সাইট আপডেট হয়েছে। টপবারের বেল এখন **channel-সচেতন** — সক্রিয়
   চ্যানেল সেকশনে থাকলে শুধু সেই চ্যানেলের (+ channel-নিরপেক্ষ) নোটিফিকেশন তালিকায় দেখায়,
   প্রতিটা আইটেমে ছোট চ্যানেল-আইকন থাকে, কিন্তু আনরিড **কাউন্ট ব্যাজ** সবসময় অ্যাকাউন্ট-ভিত্তিক
   (দুই চ্যানেল মিলিয়ে) — অন্য চ্যানেলে কিছু হলে সেটা মিস হয়ে যাবে না। লিস্টে আর গণনায় মিসম্যাচ
   থাকলে ("এই চ্যানেলে কিছু নেই, অন্য চ্যানেলে আছে") একটা ছোট হিন্ট দেখায়।
4. **AI চ্যাটবট ও নলেজ বেস**: নতুন `messenger_ai_settings`/`messenger_knowledge_base_documents`/
   `messenger_knowledge_base_chunks` টেবিল + `set_messenger_ai_api_key`/`get_messenger_ai_api_key`/
   `search_messenger_knowledge_base` RPC (migration 0045) — WhatsApp এর
   `workspace_ai_settings`/`knowledge_base_documents` এর schema/PK কিছুই বদলায়নি, সম্পূর্ণ
   সমান্তরাল নতুন টেবিল (কম ঝুঁকির পথ)। storage bucket নতুন লাগেনি — বিদ্যমান প্রাইভেট
   `knowledge-base-docs` bucket reuse, Messenger এর ফাইল পাথ
   `{workspace_id}/messenger/{file}` (WhatsApp এর `{workspace_id}/{file}` থেকে আলাদা, কিন্তু
   `workspace_id` প্রথম ফোল্ডারে থাকায় bucket এর storage RLS policy এর শর্ত অক্ষত থাকে)।
   `apps/worker/src/lib/ai-reply.ts`-এর `tryAiReply()` এখন `channel` অনুযায়ী সঠিক
   টেবিল/RPC বাছে। Messenger এর AI চ্যাটবট পেজ (`/dashboard/messenger/ai-chatbot`) এখন
   সম্পূর্ণ আসল সেটিংস পেজ (আগে WhatsApp এর পেজে রিডাইরেক্ট করত এমন একটা তথ্য-কার্ড ছিল) —
   নিজস্ব provider/API key/system prompt/সাপোর্ট নাম্বার/ডেলিভারি সময়/নলেজ বেস আপলোড, আর
   একটা **"WhatsApp থেকে কপি করুন" বাটন** (এককালীন — শুধু টেক্সট ফিল্ড কপি করে: system
   prompt, সাপোর্ট নাম্বার, ডেলিভারি সময়, provider; API key কপি হয় না, আলাদাভাবে বসাতে হবে,
   যাতে নতুন কোনো Vault-to-Vault RPC লাগে না)।
5. **nav-config.ts**: `CHANNEL_REGISTRY` (রেজিস্ট্রি/ম্যাপ প্যাটার্ন) — নতুন চ্যানেল ভবিষ্যতে
   এখানে একটা entry (pathPrefix + navGroups) যোগ করলেই `getNavGroups()`/
   `getChannelFromPathname()` কাজ করবে, কোনো ternary/if-branch এডিট করা লাগে না।

### Migration চালানোর ক্রম

M2 এর ৪টার (0040→0043) পরে দুইটা নতুন:

5. `0044_notifications_channel.sql` — ⚠️ `notifications` লাইভ টেবিল, কম-ট্রাফিকের সময়
   চালানোর পরামর্শ (nullable কলাম, metadata-only অপারেশন, দ্রুত শেষ হওয়ার কথা)।
6. `0045_messenger_ai_chatbot.sql` — নতুন টেবিল/ফাংশন, কোনো বিদ্যমান টেবিল alter হয়নি —
   ঝুঁকি কম, কিন্তু extension/vault ফাংশন তৈরি করে বলে কম-ট্রাফিকের সময় চালানোর পরামর্শ।

### টেস্ট করার ধাপ

1. **অর্ডার**: `/dashboard/orders` এ গিয়ে দেখুন শুধু WhatsApp অর্ডার আসছে, কোনো Messenger
   ব্যাজ নেই। `/dashboard/messenger/orders` এ গিয়ে দেখুন শুধু Messenger অর্ডার আসছে, পেজের
   নাম দেখাচ্ছে। দুই পেজেই স্ট্যাটাস বদলে কাস্টমারকে মেসেজ যাচ্ছে কিনা আগের মতোই চেক করুন।
2. **ড্যাশবোর্ড**: `/dashboard` এ "সব" ট্যাব আর নেই, শুধু WhatsApp/Messenger। Messenger
   ট্যাবে গিয়ে ৪টা স্ট্যাট কার্ড, চার্ট (কয়েকদিন মেসেজ চালাচালি করলে বার দেখা উচিত), সাম্প্রতিক
   কার্যক্রম দেখুন। দুই ট্যাবেই "প্ল্যান ব্যবহার" কার্ড একই সংখ্যা দেখানো উচিত।
3. **নোটিফিকেশন**: WhatsApp এ একটা হ্যান্ডঅফ ঘটান (AI কে না-জানা প্রশ্ন করুন), Messenger
   ট্যাবে থেকে বেল খুলুন — ওটা তালিকায় না থাকা উচিত কিন্তু কাউন্ট ব্যাজে যোগ হওয়া উচিত, আর
   "এই চ্যানেলে কিছু নেই, অন্য চ্যানেলে আছে" হিন্ট দেখা উচিত। WhatsApp ট্যাবে ফিরে বেল খুললে
   সেটা তালিকায় দেখা উচিত।
4. **AI চ্যাটবট**: `/dashboard/messenger/ai-chatbot` এ গিয়ে "WhatsApp থেকে কপি করুন" চাপুন
   (আগে WhatsApp এর AI Chatbot এ কিছু সেটআপ করা থাকতে হবে) — system prompt/নাম্বার/ডেলিভারি
   সময় কপি হওয়া উচিত, API key না। নিজে Messenger এর জন্য আলাদা API key বসান, একটা ডকুমেন্ট
   আপলোড করুন (WhatsApp এর থেকে ভিন্ন কিছু লিখুন), Messenger এ মেসেজ পাঠিয়ে AI সেই নতুন
   তথ্য থেকে উত্তর দিচ্ছে কিনা যাচাই করুন (আর WhatsApp এর AI পুরনো/নিজের ডকুমেন্ট থেকেই উত্তর
   দিচ্ছে, Messenger এর ডকুমেন্ট থেকে না — এটাই প্রমাণ করবে দুই চ্যানেল সত্যিই আলাদা)।

---

## ফেজ ২ — বিটার বেসিক (অ্যাকাউন্ট-লেভেল, শেয়ার্ড) (সম্পন্ন)

সাতটা আইটেম, বেশিরভাগই অ্যাকাউন্ট-লেভেল (দুই চ্যানেলেই এক), দুটো চ্যানেল-নির্দিষ্ট বাগফিক্স।

### কী বদলেছে

1. **পাসওয়ার্ড রিসেট**: `/forgot-password` (ইমেইল দিন) → Supabase `resetPasswordForEmail` →
   ইমেইলের লিংকে `/reset-password` (হ্যাশে `#access_token=...&type=recovery`, client-side
   পার্স হয়)। নতুন env `APP_PUBLIC_URL` (সার্ভার-সাইড, `MESSENGER_PUBLIC_URL` এর থেকে আলাদা
   — এটা https বাধ্যতামূলক না, লোকাল ডেভে `http://localhost:3000` ভ্যালিড) রিডাইরেক্ট URL
   বানাতে ব্যবহার হয় (`apps/web/lib/public-url.ts`)। middleware.ts এ এখন একটা
   `publicPaths` লিস্ট (আগে শুধু `/login`/`/signup` হার্ডকোডেড ছিল)। সেটিংস পেজে "প্রোফাইল"
   (নাম বদলান) আর "পাসওয়ার্ড বদলান" কার্ড (লগইন থাকা অবস্থায়, পুরনো পাসওয়ার্ড লাগে না)।
2. **আইনি পাবলিক পেজ**: `/terms`, `/privacy`, `/data-deletion` — route group `(legal)` এর
   নিজস্ব সাধারণ লেআউট (সাইডবার ছাড়া)। privacy পেজে স্পষ্ট লেখা আছে WhatsApp **ও** Messenger
   দুই চ্যানেল থেকেই কাস্টমারের নাম/ফোন/PSID/মেসেজ/মিডিয়া সংগ্রহ হয়। প্রতিটার নিচে
   "আইনজীবীর যাচাই প্রয়োজন" নোট — **এগুলো লাইভ করার আগে অবশ্যই একজন আইনজীবীকে দেখাতে
   হবে**, বিশেষ করে `data-deletion` পেজ (Meta App Dashboard এ এই লিংক বসাতে হবে, তারিখ/
   সাপোর্ট ইমেইল এখনো প্লেসহোল্ডার)। লগইন/সাইনআপ ফর্মে লিংক যোগ হয়েছে।
3. **সহায়তা লিংক**: সাইডবারের নিচে, নতুন env `NEXT_PUBLIC_SUPPORT_WHATSAPP` (খালি থাকলে
   লিংকটাই দেখায় না)।
4. **হলুদ ব্যানার**: প্ল্যানের মেয়াদ ≤৭ দিন বাকি (`workspaces.subscription_expires_at`,
   subscription-maintenance.ts এ ইতিমধ্যে ব্যবহৃত কলাম reuse) অথবা মাসিক মেসেজ কোটা ≥৮০%
   — দুই চ্যানেলেই (ট্যাবের বাইরে, অ্যাকাউন্ট-লেভেল) একই ব্যানার দেখায়। কোনো নতুন ক্রন/কলাম
   লাগেনি।
5. **অনবোর্ডিং চেকলিস্ট**: `OnboardingChecklist.tsx` (শেয়ার্ড কম্পোনেন্ট) — সব ধাপ শেষ হলে
   কার্ড অটো-হাইড। WhatsApp: নাম্বার কানেক্ট, বট সেটআপ (`workspace_ai_settings`), প্রথম
   কন্টাক্ট, প্রথম ক্যাম্পেইন (status যাই হোক)। Messenger: পেজ কানেক্ট, বট সেটআপ
   (`messenger_ai_settings`), প্রথম কমেন্ট রুল। **শেষ আইটেমটা (কমেন্ট রুল) এখনো তৈরিই হয়নি
   (ফেজ ৩ তে আসবে)** — তাই এটা `pending: true` ফ্ল্যাগ দিয়ে "সব শেষ" হিসাবের বাইরে রাখা
   হয়েছে (নাহলে Messenger চেকলিস্ট কার্ড কখনো হাইড হতো না), কিন্তু তালিকায় "(কমেন্ট অটোমেশন
   শীঘ্রই আসছে)" নোটসহ দেখা যাবে।
6. **Messenger ইনবক্সের মিশ্র সংখ্যা ফিক্স**: `ConversationThread.tsx` এর ২৪-ঘণ্টা/Human
   Agent ব্যাজে `Math.round()`/`Math.ceil()` এর রেজাল্ট এখন `.toLocaleString("bn-BD")` দিয়ে
   যাচ্ছে (আগে বাংলা টেক্সটের মাঝে ইংরেজি সংখ্যা মিশে থাকত)।
7. **গ্রুপ "ORDER:" ডুপ্লিকেট ফিক্স**: যাচাই করে দেখা গেছে — এটা ফিক্স **হয়নি** ছিল। BullMQ
   job retry হলে (`attempts: 3`) পুরো `handleGroupMessage()` আবার চলত, আর `orders` টেবিলে
   ইনসার্টের কোনো idempotency key ছিল না — তাই retry তে একই অর্ডার দ্বিতীয়বার সেভ হয়ে যেত।
   নতুন `orders.provider_message_id` কলাম + `(workspace_id, provider_message_id)` partial
   unique index (migration 0046) — গ্রুপ ক্যাপচারের দুটো insert-ই (malformed/সফল) এখন
   `key.id` পাঠায়, `23505` ধরলে "আগেই ক্যাপচার হয়েছে" লগ করে চুপচাপ স্কিপ করে (নতুন ডুপ্লিকেট
   অর্ডার/নোটিফিকেশন না পাঠিয়ে)। **স্কোপ নোট**: AI-চ্যাট থেকে সেভ হওয়া অর্ডারে (`ai-reply.ts`
   এর `saveOrder`) এখনো এই dedup wiring করা হয়নি — তাত্ত্বিকভাবে একই ধরনের retry-ডুপ্লিকেট
   ঝুঁকি থাকতে পারে, কিন্তু এই ফেজের স্কোপ শুধু গ্রুপের regex ক্যাপচার ছিল (ইউজার যা
   জিজ্ঞেস করেছিলেন)। ভবিষ্যতে দরকার হলে একই কলাম reuse করা যাবে, নতুন migration লাগবে না।

### Migration চালানোর ক্রম

Phase ১ এর ৫টার (0040→0045) পরে শুধু একটা নতুন:

6. `0046_orders_dedup.sql` — ⚠️ `orders` লাইভ টেবিল, কম-ট্রাফিকের সময় চালানোর পরামর্শ।
   nullable কলাম + partial unique index (DEFAULT ছাড়া), metadata-only অপারেশন।

### টেস্ট করার ধাপ

1. **পাসওয়ার্ড রিসেট**: `.env.local` এ `APP_PUBLIC_URL=http://localhost:3000` বসান। Supabase
   Dashboard → Authentication → URL Configuration এ Redirect URLs এ
   `http://localhost:3000/reset-password` যোগ করুন (allow-list এ না থাকলে Supabase লিংক
   রিজেক্ট করবে)। `/login` → "পাসওয়ার্ড ভুলে গেছেন?" → ইমেইল দিন → ইমেইলে আসা লিংকে ক্লিক →
   `/reset-password` এ "লিংক যাচাই হচ্ছে..." এর পর ফর্ম আসা উচিত → নতুন পাসওয়ার্ড দিয়ে লগইন
   করে দেখুন। সেটিংস পেজেও "পাসওয়ার্ড বদলান" কার্ড টেস্ট করুন।
2. **আইনি পেজ**: লগইন ছাড়াই `/terms`, `/privacy`, `/data-deletion` খুলে দেখুন (middleware
   ব্লক করছে না তো)। লগইন/সাইনআপ পেজে লিংক কাজ করছে কিনা দেখুন।
3. **সহায়তা লিংক**: `.env.local` এ `NEXT_PUBLIC_SUPPORT_WHATSAPP=8801XXXXXXXXX` বসিয়ে
   সাইডবারের নিচে লিংক আসছে কিনা, wa.me তে ঠিক নাম্বারে যাচ্ছে কিনা দেখুন। খালি রাখলে লিংক
   না দেখানোও যাচাই করুন।
4. **ব্যানার**: Supabase এ ম্যানুয়ালি কোনো workspace এর `subscription_expires_at` আজ থেকে
   ৫ দিন পরে সেট করে ড্যাশবোর্ডে হলুদ ব্যানার আসছে কিনা দেখুন। `messages_used_this_cycle` কে
   `monthly_message_limit` এর ৮৫%-এ বসিয়ে কোটা-ব্যানারও যাচাই করুন।
5. **অনবোর্ডিং চেকলিস্ট**: নতুন/খালি workspace দিয়ে দেখুন কার্ড আছে, ধাপে ধাপে পূরণ করে
   (নাম্বার কানেক্ট, AI সেটিংস সেভ, কন্টাক্ট যোগ, ক্যাম্পেইন বানান) প্রতিটা চেক হয়ে যাচ্ছে
   কিনা, সব শেষে কার্ডটা হাইড হয়ে যাচ্ছে কিনা দেখুন। Messenger এ "কমেন্ট রুল" আইটেম সবসময়
   পেন্ডিং থাকা সত্ত্বেও বাকি দুটো শেষ হলে কার্ড হাইড হচ্ছে কিনা (এটাই আসল টেস্ট পয়েন্ট)।
6. **Messenger ব্যাজ**: Messenger ইনবক্সে একটা কথোপকথনে গিয়ে "উইন্ডো: X ঘণ্টা বাকি" ব্যাজে
   সংখ্যাটা সম্পূর্ণ বাংলা অঙ্কে (০-৯ না, ০১২...) দেখা উচিত।
7. **গ্রুপ অর্ডার ডুপ্লিকেট**: একটা গ্রুপে "ORDER: নাম, নাম্বার, প্রোডাক্ট" মেসেজ পাঠান, অর্ডার
   তৈরি হওয়ার পর worker লগে সেই job এর জন্য ইচ্ছাকৃতভাবে একটা এরর ছুঁড়ে (বা Redis এ job
   আবার queue করে) retry ট্রিগার করুন — দ্বিতীয়বার `orders` টেবিলে নতুন রো তৈরি না হয়ে
   worker লগে "duplicate order ignored" আসা উচিত।

---

## সাধারণ নোট

- প্রতিটা ধাপে নতুন migration ফাইল শুধু লেখা হবে, ইউজার নিজে Supabase এ চালাবেন — কোনো
  ধাপেই আমি নিজে ডাটাবেসে কমান্ড চালাব না।
- WhatsApp এর কোনো worker প্রসেসর/server action/কোয়েরি কখনো এই কাজের জন্য বদলানো হবে না —
  Messenger এর নিজস্ব সমান্তরাল ফাইল/ফাংশন থাকবে (M0 এর `process-inbox-media.ts` vs
  `process-group-media.ts` এর প্যাটার্নে, যেটা এই প্রজেক্টে আগেও ব্যবহার হয়েছে)।
