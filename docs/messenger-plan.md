# Messenger চ্যানেল — রোডম্যাপ (M0-M5)

এই ডকুমেন্ট Facebook Messenger চ্যানেল যোগ করার প্রতিটা ধাপের পরিকল্পনা রাখে। **M0 (কাঠামো)
সম্পন্ন** — এই ধাপে শুধু DB টেবিল, UI খোলস, ফিচার ফ্ল্যাগ; কোনো আসল Messenger লজিক (OAuth,
webhook, মেসেজ পাঠানো) এখনো নেই।

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

## M1 — পেজ কানেক্ট ও Webhook

**লক্ষ্য**: Facebook Login for Business দিয়ে OAuth flow, Page Access Token আনা (Vault এ
সেভ), webhook সাবস্ক্রাইব করা।

**দরকারি Meta পারমিশন** ([Meta ডকুমেন্টেশন](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview) অনুযায়ী):
- `pages_show_list` — ইউজারের পেজ তালিকা দেখতে (কোনটা কানেক্ট করবে বাছাই করার জন্য)
- `pages_manage_metadata` — পেজের জন্য Messenger webhook ইভেন্ট সাবস্ক্রাইব/আনসাবস্ক্রাইব করতে
- `pages_messaging` — মূল পারমিশন, মেসেজ পাঠানো/পড়ার জন্য
- `pages_read_engagement` — পেজের কনটেন্ট/এনগেজমেন্ট পড়তে
- `business_management` — উপরের কয়েকটার (`pages_messaging`, `pages_show_list`) নির্ভরতা,
  App Review submission এ আলাদাভাবে উল্লেখ করতে হবে

এই সবগুলোই Advanced Access দরকার হয় প্রোডাকশনে, মানে **Meta App Review বাধ্যতামূলক** —
রিভিউ টিম বট টেস্ট করে দেখবে প্রতিটা পারমিশন আসলেই দরকার কিনা।

**কাজ**: OAuth কোড এক্সচেঞ্জ (`exchangeCodeForPageToken` — messenger-types.ts তে স্টাব করা
আছে), long-lived token এ কনভার্ট, Vault এ সেভ (workspace_ai_settings.api_key_secret_id এর
প্যাটার্নে নতুন `set_messenger_page_token`/`get_messenger_page_token` RPC লাগবে),
`messenger_pages` রো insert, webhook সাবস্ক্রাইব (`messages`, `messaging_postbacks`,
`feed` fields)।

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

## সাধারণ নোট

- প্রতিটা ধাপে নতুন migration ফাইল শুধু লেখা হবে, ইউজার নিজে Supabase এ চালাবেন — কোনো
  ধাপেই আমি নিজে ডাটাবেসে কমান্ড চালাব না।
- WhatsApp এর কোনো worker প্রসেসর/server action/কোয়েরি কখনো এই কাজের জন্য বদলানো হবে না —
  Messenger এর নিজস্ব সমান্তরাল ফাইল/ফাংশন থাকবে (M0 এর `process-inbox-media.ts` vs
  `process-group-media.ts` এর প্যাটার্নে, যেটা এই প্রজেক্টে আগেও ব্যবহার হয়েছে)।
