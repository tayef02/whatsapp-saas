# ইমেইল মার্কেটিং চ্যানেল — পরিকল্পনা (branch `email`)

WhatsApp ও Messenger-এর পাশে তৃতীয়, **সম্পূর্ণ আলাদা** সেকশন। নিজস্ব টেবিল (`email_*`), নিজস্ব পেজ
(`/dashboard/email/*`), নিজস্ব queue/worker, নিজস্ব কোটা। শুধু অ্যাকাউন্ট-লেভেল জিনিস শেয়ার্ড (লগইন/workspace,
প্ল্যান ও বিলিং, নোটিফিকেশন, অ্যাডমিন)।

> অবস্থা: **শুধু পরিকল্পনা — কোনো কোড বা migration লেখা হয়নি।** স্কিমা বদলের আগে প্রতিটা migration-এর আলাদা
> অনুমোদন লাগবে (নিচে "খোলা প্রশ্ন")।

## ০) নেওয়া সিদ্ধান্ত ও ভিত্তি

| # | সিদ্ধান্ত |
|---|---|
| ১ | `email` branch `messenger-phase4`-এর উপর (খালি যাচাই করে রিসেট করা হয়েছে)। ইমেইলের প্রথম migration **`0054`** |
| ২ | বিটা: **Resend (ফ্রি)**, `EmailProvider` interface-এর পেছনে (লঞ্চে Amazon SES)। একটা **প্ল্যাটফর্ম ডোমেইন** থেকে সবাই পাঠায়, workspace-ভেদে শুধু **From নাম** আলাদা। provider-এর দৈনিক (ডিফল্ট ১০০) ও মাসিক (৩০০০) সীমা env থেকে, scheduler-এ আটকানো; সীমা ছুঁলে বাকিগুলো পরের দিন, কারণসহ রেকর্ড। webhook: signature যাচাই বাধ্যতামূলক, raw body, queue, তখনই 200। API key শুধু `.env`-এ |
| ৩ | কোটা আলাদা: `plans.monthly_email_limit`, `workspaces.email_messages_used_this_cycle` + সাইকেল-শুরুর তারিখ। গোনা **একটাই** DB ফাংশনে `record_email_sent()`। scheduler পাঠানোর **আগেই** কোটা আটকায় |
| ৪ | `messages` partition ফিক্স এখন নয় (আলাদা কাজ, জানা ঝুঁকি: ২০২৭-০২ থেকে সব মেসেজ `messages_default`-এ যাবে) |

### Resend সম্পর্কে যাচাইকৃত তথ্য (ডকুমেন্টেশন থেকে, অনুমান নয়)
| বিষয় | তথ্য | নকশায় প্রভাব |
|---|---|---|
| ফ্রি প্ল্যান | ৩০০০/মাস, **১০০/দিন**, ৩টা ডোমেইন, **১টা webhook endpoint**, ৩০ দিন লগ | একটাই URL `/api/webhooks/email`; লোকাল ডেভ ও প্রোডাকশন একসাথে webhook পাবে না |
| API rate limit | **১০ রিকোয়েস্ট/সেকেন্ড, পুরো team-এ** (সব key মিলিয়ে); ৫২৯ নয় **429** + `retry-after` | worker-এ queue-wide limiter, ডিফল্ট ৫/সেকেন্ড (বাকিটা ডোমেইন-চেক ইত্যাদির জন্য রাখা) |
| Idempotency | `Idempotency-Key` হেডার, **২৪ ঘণ্টা**, সর্বোচ্চ ২৫৬ অক্ষর | key = `email_<recipient_id>` — retry-তে ডাবল পাঠানো provider-ই আটকায় (WhatsApp পাইপলাইনে এই গার্ড নেই) |
| পাঠানো | `POST /emails`; `from`, `to`, `reply_to`, `subject`, `html`, `text`, custom `headers`, `tags`; `to` সর্বোচ্চ ৫০ | আমরা একজন-একজন করে পাঠাই (প্রতি জনের আলাদা unsubscribe টোকেন); `tags` দিয়ে `rid` (recipient id) পাঠাই — webhook-এ ফেরত আসে |
| Webhook | **Svix** ফরম্যাট: হেডার `svix-id`, `svix-timestamp`, `svix-signature` (`v1,<base64>`, একাধিক স্পেস-দিয়ে-আলাদা); সাইন করা স্ট্রিং `${id}.${timestamp}.${rawBody}`; HMAC-SHA256, কী = `whsec_` বাদ দিয়ে base64-ডিকোড; constant-time তুলনা | নতুন প্যাকেজ ছাড়াই Node `crypto` দিয়ে নিজে যাচাই। timestamp সহনশীলতা ৫ মিনিট (replay রোধ)। dedupe কী = `svix-id` |
| ইভেন্ট | `email.sent / delivered / delivery_delayed / bounced / complained / opened / clicked / failed / suppressed` | bounce payload: `data.email_id`, `data.to[]`, `data.bounce.type` (`Permanent`/`Temporary`…), `subType`, `message` |
| ডোমেইন API | `POST /domains` (→ `records[]`: SPF, DKIM, MX(return-path), ঐচ্ছিক Tracking; প্রতিটার `status`), `GET /domains/{id}`, `POST /domains/{id}/verify` | **DMARC Resend যাচাই করে কি না ডকুমেন্টেশনে স্পষ্ট নেই** → DMARC আমরা নিজে DNS-এ দেখবো |
| **যা ডকুমেন্টেশনে স্পষ্ট পাইনি** | ডোমেইনের সম্পূর্ণ status-তালিকা (শুধু `not_started`/`pending` নিশ্চিত); bounce `type`-এর পূর্ণ তালিকা; Resend-এর নিজস্ব bounce/complaint সীমা (ছাড়লে অ্যাকাউন্ট সীমিত হয় কি না); মার্কেটিং/বাল্ক ইমেইল ট্রানজ্যাকশনাল API দিয়ে পাঠানোর নীতি | adapter অজানা মান পেলে **নিরাপদ দিক** ধরবে (অজানা status = verified নয়; অজানা bounce = soft); ইমপ্লিমেন্টেশনের আগে Resend-এর Acceptable Use/মার্কেটিং নীতি আবার দেখে নেবো — **আপনি আগেই একবার দেখে রাখুন**, কারণ বিটার পুরো পথ এর উপর |

## ১) কাজ কীভাবে ভাগ হবে

| ফেজ | কী | migration |
|---|---|---|
| **ইমেইল ফেজ ১** (এই পরিকল্পনা) | provider interface + Resend, ডোমেইন যাচাই (পেজ+জব), sender প্রোফাইল, suppression, unsubscribe টোকেন/পেজ/হেডার, webhook (signature→queue→event সংরক্ষণ), টেস্ট-ইমেইল, feature flag, নেভ কাঠামো | `0054` |
| ফেজ ২ | ইমেইল কন্টাক্ট (CSV/Excel ইম্পোর্ট, ট্যাগ, ডুপ্লিকেট বাদ), টেমপ্লেট (সহজ এডিটর, বাংলা ফন্ট) | `0055` |
| ফেজ ৩ | ক্যাম্পেইন, scheduler, পাঠানো, কোটা, `record_email_sent`, bounce/complaint প্রক্রিয়া | `0056` |
| ফেজ ৪ | ডেলিভারি রিপোর্ট, অটো-পজ, সাইকেল রোলওভার, ঘষামাজা | `0057`? (দরকার হলে) |

**ফেজ ১-এ থাকবে না**: কন্টাক্ট/টেমপ্লেট/ক্যাম্পেইন UI, আসল ক্যাম্পেইন পাঠানো। ইমেইল চ্যানেল শুধু অ্যাডমিন ও
ঘোষিত টেস্টার দেখবে (flag), তাই প্রোডাকশনে সাধারণ ইউজারের চোখে পড়বে না।

---

## ২) ফেজ ১ — টেবিল ও কলাম (migration `0054_email_foundation.sql`)

সব `uuid` pk, `gen_random_uuid()`। কোনো `serial`/`bigserial` নেই → sequence GRANT লাগে না (migration 0024-এর শিক্ষা)।

### `email_domains` — পাঠানোর ডোমেইন
| কলাম | বিবরণ |
|---|---|
| `id` | pk |
| `workspace_id` | **NULL = প্ল্যাটফর্ম ডোমেইন (বিটা)**; লঞ্চে workspace-এর নিজের ডোমেইনও এই টেবিলেই (এখন বানাবো না) |
| `domain` | lower-case, `unique (lower(domain))` |
| `provider` | `resend` \| `ses` |
| `provider_domain_id` | Resend-এর id |
| `status` | `pending` \| `verified` \| `failed` \| `suspended` |
| `spf_status`, `dkim_status` | `missing` \| `pending` \| `verified` \| `failed` (provider-এর record status থেকে) |
| `dmarc_status` | `missing` \| `present` \| `invalid` (আমাদের নিজের DNS দেখা) |
| `dmarc_policy` | `none` \| `quarantine` \| `reject` (null = নেই) |
| `dns_records` | jsonb — দেখানোর জন্য (`record, type, name, value, priority, status`) |
| `from_local` | `From` অ্যাড্রেসের স্থানীয় অংশ, ডিফল্ট `hello` → `hello@<domain>` |
| `verified_at` | **প্রথমবার** verified হওয়ার সময় = warm-up শুরুর ভিত্তি |
| `last_checked_at`, `last_error` | `last_error` শুধু সংক্ষিপ্ত কোড, কোনো key/টোকেন নয় |
| `is_active` | partial unique index: প্ল্যাটফর্মে (`workspace_id is null`) একটাই active |
| `created_at`, `updated_at` | |

### `email_sender_profiles` — workspace-ভেদে From নাম ও ঠিকানা (প্রতি workspace-এ ১টা)
`workspace_id` (pk, fk) · `from_name` (১–৬০ অক্ষর; `< > @ " ,` ও নতুন লাইন নিষিদ্ধ — header injection ও ছদ্মবেশ ঠেকাতে) ·
`reply_to_email` · `reply_to_verified_at` · `business_name` · `postal_address` (ফুটারে বাধ্যতামূলক — Gmail/Yahoo ও আইনি
সেরা-অনুশীলন) · `created_at`, `updated_at`.
**"পাঠানোর জন্য প্রস্তুত"** = চারটাই পূরণ + `reply_to_verified_at` আছে (+ প্ল্যাটফর্ম ডোমেইন verified)।

### `email_suppressions` — এই workspace-এ আর কখনো পাঠানো যাবে না
`id` · `workspace_id` · `email_lower` · `reason` (`unsubscribed` \| `hard_bounce` \| `repeated_soft_bounce` \| `complaint` \|
`manual`) · `source` (`unsubscribe_link` \| `one_click` \| `webhook` \| `import` \| `owner`) · `campaign_id` (null, FK ফেজ ৩-এ) ·
`detail` (সংক্ষিপ্ত, কোনো ইমেইল-বডি নয়) · `created_at` · **`unique (workspace_id, email_lower)`**.
suppression **প্রতি workspace-এ আলাদা** (এক ব্যবসার তালিকা অন্যকে জানাবে না — ডেটা মিশবে না)।

### `email_events` — webhook ইভেন্ট (dedupe + অডিট)
`id` · `workspace_id` (null হতে পারে: টেস্ট/অজানা মেসেজ) · `recipient_id` (null; FK ফেজ ৩-এ) · `provider` · `provider_event_id`
(= `svix-id`) · `provider_message_id` · `event_type` (উপরের তালিকা) · `bounce_type` (`hard`/`soft`/null) · `detail` jsonb
(শুধু দরকারি অংশ: bounce উপধরন, ক্লিকের লিংকের ডোমেইন — **প্রাপকের ঠিকানা, সাবজেক্ট, বডি রাখি না**) · `occurred_at` ·
`processed_at` · `process_error` · `created_at` · **`unique (provider, provider_event_id)`** — একই ইভেন্ট দুইবার এলে
দ্বিতীয়বার কিছু হয় না। ৯০ দিনের পুরনো আর্কাইভ (CLAUDE.md-র নিয়ম)।

### `email_send_log` — provider-লেভেলের পাঠানো গণনা (দৈনিক/মাসিক সীমার জন্য)
`id` · `provider` · `kind` (`campaign` \| `test` \| `system`) · `workspace_id` (null) · `recipient_id` (null) · `sent_at default now()` ·
index `(sent_at)`। **কমপক্ষে ৩৫ দিন রাখা হবে** (rolling-৩০-দিনের হিসাবের জন্য)। এখানে শুধু "একটা ইমেইল গেছে" — কোনো কনটেন্ট নেই।

### `notifications.channel` CHECK-এ `'email'` যোগ
`notifications` live টেবিল; `NOT VALID` দিয়ে constraint বসিয়ে আলাদা ধাপে `VALIDATE` (দীর্ঘ লক এড়াতে)। সাথে TypeScript
union (`notify.ts`, `nav-config.ts`, `NotificationBell`, `DashboardShell`)-এ `email`। `orders.channel` **বদলাচ্ছে না**
(ইমেইলে অর্ডার নেই)।

### ফাংশন (সব `security definer`, `search_path = public`, শুধু `service_role` চালাতে পারে)
- `unsubscribe_email(p_workspace_id, p_email, p_campaign_id, p_source) returns boolean` — suppression-এ idempotent insert; নতুন হলে `true`।
  (ফেজ ৩-এ `create or replace` করে এটা pending recipients-ও `skipped` করবে ও stats বাড়াবে।)

---

## ৩) ভবিষ্যৎ ফেজের টেবিল — পূর্বরূপ (এখন বানাচ্ছি না; অনুমোদনের জন্য)

**`0055` (ফেজ ২):** `email_contacts` (`email`, `email_lower` generated, `name`, `tags text[]`, `custom_fields jsonb`,
`consent_source`, `consented_at`, `unique(workspace_id, email_lower)`, **কোনো `opted_out` ফ্ল্যাগ নেই** — suppression-ই একমাত্র
সত্য, দুই জায়গায় দুই মান হওয়ার ঝুঁকি নেই), `email_contact_imports` (`contact_imports`-এর মতো + `suppressed_count`),
`email_templates` (`subject`, `preheader`, `body_html`, `body_text`, `editor_json` রিজার্ভ), বাকেট `email-imports` (private),
`email-media` (ছবি — ইমেইল পরে খোলা হয়, তাই signed-URL নয়, অনুমানযোগ্য নয় এমন uuid পাথে public-read)।

**`0056` (ফেজ ৩):** `email_campaigns` (subject/html-এর **স্ন্যাপশট** কপি, `status`, `paused_reason`, `audience_tag`,
`scheduled_at`, `email_domain_id`), `email_campaign_stats` (sent/delivered/opened/clicked/bounced/complained/unsubscribed/
failed/skipped), `email_recipients` (প্রতি জনের স্ট্যাটাস; `unique(campaign_id, email_lower)`; `provider_message_id` partial
unique; **partition করছি না** — নিচে খোলা প্রশ্ন ৬), `email_deferrals` (কোন ক্যাম্পেইন কেন কতজন পিছিয়ে আছে)।
সাথে `plans.monthly_email_limit`, `plans.email_contact_limit`, `workspaces.email_messages_used_this_cycle`,
`email_cycle_started_at`, `email_daily_limit`; ফাংশন `create_email_campaign`, `schedule_email_batch`, `record_email_sent`,
`apply_email_event`, `mark_stuck_email_recipients_unknown`।

**ইমেইল-ফেজ ২-এর জন্য রিজার্ভ (টেবিল নয়, শুধু জায়গা):** `email_campaigns.kind` (ডিফল্ট `broadcast`; পরে `drip`/`triggered`/`ab_variant`),
`automation_id`, `segment_id`, `flow_id` (মাল্টি-চ্যানেল), `variant_of`/`variant_label` (A/B) — সবই nullable, FK ছাড়া;
`email_recipients.step_no` (drip)। ভবিষ্যৎ টেবিলের নাম এখনই ঠিক: `email_automations`, `email_automation_steps`,
`email_segments`, `email_ab_tests`। AI-লেখা: বিদ্যমান Messenger/WhatsApp AI সেটিংসের ধাঁচে আলাদা `email_ai_settings`।

---

## ৪) RLS ও GRANT (ফেজ ১ টেবিল)

| টেবিল | authenticated | service_role | পলিসি |
|---|---|---|---|
| `email_domains` | **কলাম-লেভেল select** (`id, workspace_id, domain, status, spf/dkim/dmarc_status, dmarc_policy, dns_records, verified_at, last_checked_at`) — `provider_domain_id`, `last_error` বাদ | সব | select: `workspace_id is null` (প্ল্যাটফর্ম, DNS তথ্য গোপন না) **অথবা** `is_workspace_member(workspace_id)`। লেখা: শুধু service_role (সুপার-অ্যাডমিন সার্ভার অ্যাকশন) |
| `email_sender_profiles` | select, insert, update | সব | select: member; insert/update: `is_workspace_admin` (owner/admin) |
| `email_suppressions` | **শুধু select** | সব | select: member। কোনো insert/update/delete নেই — `unsubscribed`/`complaint` মোছা যায় না; মালিকের "ম্যানুয়াল ব্লক" সার্ভার অ্যাকশন (role যাচাই করে admin ক্লায়েন্টে) |
| `email_events` | শুধু select | সব | select: `workspace_id is not null and is_workspace_member(workspace_id)`; অজানা (null) শুধু service_role |
| `email_send_log` | কিছু নেই | সব | RLS চালু, কোনো authenticated পলিসি নেই |

নিয়ম: প্রতিটা টেবিলে `enable row level security` + স্পষ্ট `grant … to authenticated, service_role`; `is_super_admin()` দিয়ে
অ্যাডমিন পেজ গেট (বিদ্যমান payments-অ্যাডমিনের প্যাটার্ন)। migration ফাইলের মাথায় লাইভ-ঝুঁকি লেখা থাকবে।

## ৫) Migration ক্রম ও ডিপ্লয় ক্রম
`0054` (ফেজ ১) → `0055` (ফেজ ২) → `0056` (ফেজ ৩) → দরকার হলে `0057`। প্রতিটার আগে আপনার অনুমোদন; আপনি SQL Editor-এ
চালাবেন; **migration আগে, কোড পরে**। `0054` শুধু নতুন টেবিল + notifications-এর একটা constraint বদল — বিদ্যমান ডেটায় ঝুঁকি কম।

---

## ৬) Provider interface, queue ও worker (ফেজ ১)

**`EmailProvider`** (`packages/core/providers/email-types.ts`; WhatsApp/Messenger interface থেকে আলাদা, একই ধরনের): 
`send(msg)` → `{ providerMessageId }` · `createDomain(name)` · `getDomain(id)` · `verifyDomain(id)` ·
`verifyWebhook(rawBody, headers)` → bool · `normalizeEvents(payload)` → একই চেহারার ইভেন্ট তালিকা।
`msg` = `from{name,address}, to, replyTo, subject, html, text, headers, tags, idempotencyKey`।
**এরর শ্রেণি** (retry-নীতির জন্য): `rate_limited(retryAfter)` · `invalid_recipient` (retry নয়, `failed`) · `auth` (retry নয়, সবাইকে থামায় +
অ্যাডমিন নোটিফিকেশন) · `transient` (retry) · `rejected`।
`EmailProvider` সিলেক্ট হয় একটাই জায়গায় (`apps/worker/src/lib/email-provider.ts`, `EMAIL_PROVIDER` env) — SES-এ সরানো = নতুন ফাইল +
env বদল; বাকি কোড অপরিবর্তিত।

**Queue (ফেজ ১):** 
| Queue | কে বসায় | কাজ |
|---|---|---|
| `email-webhook-events` | web route `/api/webhooks/email` | raw ইভেন্ট → worker; jobId `email_event_<svix-id>` (কোলন নয়) |
| `email-domain-check` | worker, ২৪ ঘণ্টা repeat + অ্যাডমিন বোতামে on-demand | ডোমেইন status রিফ্রেশ + DMARC DNS দেখা |
| `email-jobs` | web (টেস্ট ইমেইল) | `test-send` job — **web থেকে সরাসরি পাঠানো নয়** (আর্কিটেকচার নিয়ম) |

(ফেজ ৩-এ যোগ: `email-scheduler` (৬০ সেকেন্ড), `email-send` (queue-wide limiter `EMAIL_SEND_RATE_PER_SEC`, ডিফল্ট ৫), `email-contact-import` (ফেজ ২)।)

**Webhook route** (Messenger-এর প্যাটার্ন): `POST /api/webhooks/email` → `request.text()` (raw) → Svix যাচাই (৩ হেডার, ৫ মিনিট
সহনশীলতা, constant-time) → ব্যর্থ হলে **401**, queue ডাউন/secret নেই হলে **500** (provider আবার চেষ্টা করবে), নয়তো queue-তে বসিয়ে
**তখনই 200**। কোনো DB কাজ route-এ নয়। worker প্রসেসর ইভেন্ট `email_events`-এ লেখে (dedupe `unique`-এ)। ফেজ ১-এ আসল প্রাপক
নেই, তাই শুধু সংরক্ষণ; ফেজ ৩-এ `apply_email_event()` যোগ হবে (status, stats, suppression)। middleware-এর matcher-এ
`api/webhooks` আগেই বাদ আছে ✓।

**নতুন env (শুধু নাম `.env.example`-এ; মান আপনি `.env`-এ):**
`EMAIL_PROVIDER` (ডিফল্ট `resend`) · `RESEND_API_KEY` · `RESEND_WEBHOOK_SECRET` · `EMAIL_PROVIDER_DAILY_LIMIT` (১০০) ·
`EMAIL_PROVIDER_MONTHLY_LIMIT` (৩০০০) · `EMAIL_SEND_RATE_PER_SEC` (৫) · `EMAIL_UNSUBSCRIBE_SECRET` (দীর্ঘ র‍্যান্ডম) ·
`NEXT_PUBLIC_EMAIL_ENABLED` (ডিফল্ট `false`; **NEXT_PUBLIC হওয়ায় Dockerfile ARG/ENV ও docker-compose `build.args`-এও** যোগ হবে)।
`RESEND_API_KEY` web ও worker দুই জায়গাতেই লাগবে (ডোমেইন তৈরি/যাচাই web সার্ভার অ্যাকশনে — কম ভলিউমের অ্যাডমিন কাজ; পাঠানো
সবসময় worker)।

---

## ৭) ডোমেইন যাচাই ফ্লো (বিটা = প্ল্যাটফর্ম ডোমেইন)

পেজ: `/dashboard/admin/email-domain` (শুধু সুপার-অ্যাডমিন)।
1. অ্যাডমিন ডোমেইন দেন — **সাবডোমেইন সুপারিশ** (যেমন `mail.<আপনার-ডোমেইন>`; মূল ডোমেইনের সুনাম আলাদা রাখতে)।
2. সার্ভার অ্যাকশন → `createDomain` → `email_domains` রো (`pending`) + `dns_records` সেভ।
3. পেজ দেখায় **কপি-করা-যায় এমন DNS তালিকা**: SPF, DKIM, return-path MX (Resend যা দেয়) + আমাদের সুপারিশকৃত DMARC
   (`_dmarc.<ডোমেইন>` TXT `v=DMARC1; p=none; …`)। প্রতিটার পাশে ব্যাজ: ✅ যাচাইকৃত / ⏳ অপেক্ষায় / ❌ নেই।
4. **"যাচাই করুন"** → `verifyDomain` + `getDomain` + আমাদের নিজের DNS দেখা (`dns/promises.resolveTxt`, নতুন প্যাকেজ নয়):
   DMARC `_dmarc.<ডোমেইন>` না পেলে মূল (organizational) ডোমেইনের `_dmarc` (DMARC উত্তরাধিকার)। DNS ছড়াতে সময় লাগে, তাই ফল
   "এখনো হয়নি" দেখালে ভুল নয় — আবার চাপা যাবে।
5. `status = verified` ⇔ SPF ও DKIM `verified` **এবং** DMARC `present` (নীতি `none` হলেও চলবে — খোলা প্রশ্ন ১)। প্রথমবার হলে
   `verified_at` বসে (warm-up শুরু)।
6. **গেট (পাঠানো বন্ধ)**: যাচাই না হলে (ক) ক্যাম্পেইন শুরু/শিডিউল করতে দেবে না (বাংলা কারণসহ), (খ) scheduler কিছু বসাবে না ও
   `email_deferrals`-এ কারণ `domain_not_verified` লেখা থাকবে, (গ) send processor প্রতিটা মেসেজের আগে আবার দেখবে।
7. দৈনিক রিচেক: আগে `verified` ছিল, এখন নয় → `status = failed`, পাঠানো আপনাআপনি থামে, সুপার-অ্যাডমিন নোটিফিকেশন
   (`channel = 'email'`)। ফিরে verified হলে আবার চলে।
8. workspace-পাশের পেজ `/dashboard/email/settings`: sender প্রোফাইল ফর্ম + "প্ল্যাটফর্ম ডোমেইন: ✅/❌" ব্যানার (শুধু দেখা)।
   **Reply-To যাচাই**: ঠিকানায় কনফার্মেশন লিংক (HMAC-সাইন করা, ২৪ ঘণ্টা মেয়াদ) পাঠানো হয়; ক্লিক না করা পর্যন্ত প্রস্তুত নয় —
   নইলে কেউ অন্যের ঠিকানা Reply-To বসিয়ে ছদ্মবেশ নিতে পারত। (কনফার্মেশন মেইলও provider-সীমায় গোনা হয়।)
9. **লঞ্চ-পথ (SES/নিজস্ব ডোমেইন):** একই টেবিল ও পেজ, শুধু `workspace_id` বসানো রো; resolve নিয়ম "workspace-এর verified নিজস্ব ডোমেইন, নইলে প্ল্যাটফর্ম"।

## ৮) Unsubscribe লিংক ও List-Unsubscribe হেডার

- **টোকেন**: `v1.<base64url(JSON{w: workspace_id, e: email_lower, c: campaign_id|null})>.<HMAC-SHA256(secret=EMAIL_UNSUBSCRIBE_SECRET)>`।
  ডেটাবেস-লুকআপ ছাড়াই যাচাই হয়, **মেয়াদ নেই** (পুরনো ইমেইলের লিংকও চলে), ডেটা মুছে গেলেও কাজ করে। টেম্পারড হলে ৪০০ (কারণ
  বলা হয় না)। ট্রেড-অফ: URL-এ প্রাপকের ইমেইল থাকে (শুধু তার নিজের লিংকে) → সার্ভার/proxy লগে এই URL **কখনো ছাপবো না** (খোলা প্রশ্ন ৯)।
- **পাবলিক রুট** `/u/<token>` (middleware-এ `/u/` প্রিফিক্স পাবলিক):
  - **GET** → শুধু নিশ্চিতকরণ পেজ ("আনসাবস্ক্রাইব করবেন?" + বোতাম), **কিছু বদলায় না** — কারণ ইমেইল-সিকিউরিটি স্ক্যানার লিংক আগেই খুলে ফেলে, GET-এ
     বদলালে সবাই ভুলে আনসাবস্ক্রাইব হয়ে যেত।
  - **POST** (বোতাম ও Gmail/Yahoo-র **one-click**, RFC 8058) → `unsubscribe_email()`; সবসময় সফল পেজ (ঠিকানা আছে কি না ফাঁস করে না)।
  - পেজ বাংলা+English একসাথে (প্রাপক অচেনা, ভাষা-কুকি নেই)। **আনডু নেই** — "আর কখনো পাঠানো যাবে না" নিয়ম।
- **হেডার (প্রতিটা ইমেইলে, system যোগ করে, টেমপ্লেট থেকে সরানো যায় না):**
  `List-Unsubscribe: <https://<APP_PUBLIC_URL>/u/<token>>` ও `List-Unsubscribe-Post: List-Unsubscribe=One-Click`।
  `mailto:` অপশন বিটায় নয় (ইনবাউন্ড ইমেইল হ্যান্ডলিং লাগে)। DKIM সাইন Resend করে।
- **বডিতে ফুটার (বাধ্যতামূলক, system যোগ করে)**: "আপনি <ব্যবসার নাম>-এর তালিকায় আছেন বলে এই ইমেইল পেয়েছেন", আনসাবস্ক্রাইব লিংক,
  `business_name` + `postal_address`। টেমপ্লেটে `{{unsubscribe_url}}` থাকলে সেখানেই বসে, ফুটার তবু যোগ হয়।
- লিংকের জন্য পাবলিক HTTPS লাগে → `APP_PUBLIC_URL` (বিদ্যমান) অবশ্যই সেট ও https; নইলে পাঠানোই বন্ধ।

## ৯) Suppression নিয়ম

| ঘটনা | কী হয় |
|---|---|
| আনসাবস্ক্রাইব (লিংক/one-click) | `unsubscribed` — **স্থায়ী**, UI থেকে মোছা যায় না, ইম্পোর্টেও ফেরত আসে না |
| hard bounce (`Permanent`) | সাথে সাথে `hard_bounce` |
| soft bounce (`Temporary`/অজানা) | প্রতি জনের পরপর **৩টা** (মাঝে কোনো `delivered` ছাড়া) → `repeated_soft_bounce` |
| complaint (spam রিপোর্ট) | সাথে সাথে `complaint` |
| মালিকের ম্যানুয়াল ব্লক | `manual` |
| import-এ আগে-থেকে-suppressed ঠিকানা | কন্টাক্ট হিসেবে ঢোকে, কিন্তু পাঠানো হয় না (`suppressed_count`-এ গোনা) |

**চেক কোথায় কোথায় (সবগুলোতে):** ক্যাম্পেইন তৈরির সময় (recipient রো `skipped` + কারণ), scheduler, send processor (provider কল
করার ঠিক আগে — WhatsApp-এর মতো দ্বিতীয়বার), webhook প্রক্রিয়া। **স্কিপ = রো থাকবে**: suppressed ঠিকানাও `email_recipients`-এ
`status='skipped'`, `skip_reason='suppressed_<কারণ>'` নিয়ে থাকে — বাদ পড়া তালিকা পর্যালোচনা করা যায়।
**ছড়িয়ে পড়া ঠেকাতে (শেয়ার্ড ডোমেইন!)** workspace-লেভেল অটো-পজ (প্রস্তাব): bounce হার ≥ ৪% (ন্যূনতম ৫০টা পাঠানোর পর) বা
complaint হার ≥ ০.১% (ন্যূনতম ২০০টা) → ক্যাম্পেইন `paused` + `paused_reason` + মালিককে নোটিফিকেশন। (সংখ্যা Resend-এর নিজস্ব সীমা দেখে চূড়ান্ত — খোলা প্রশ্ন ৭।)

## ১০) Warm-up ও সীমার নিয়ম (ফেজ ৩-এর scheduler-এ বসবে; ফেজ ১-এ শুধু নিয়ম ও ধ্রুবক ফাইল `packages/core/email/limits.ts`)

পাঠানোর অনুমতি = **এই সবগুলোর ন্যূনতম** (কোনো একটা ০ হলে কিছুই যায় না):
1. **ডোমেইন warm-up দৈনিক সীমা** — `verified_at` থেকে দিন গুনে: ১–৩ দিন ৫০ · ৪–৭ দিন ১০০ · ৮–১৪ দিন ৫০০ · ১৫–৩০ দিন ২০০০ · ৩০+ দিন ১০০০০ (প্রস্তাবিত ধাপ, কোডে একটা তালিকা)।
2. **provider দৈনিক** `EMAIL_PROVIDER_DAILY_LIMIT` (ডিফল্ট ১০০) − গত ২৪ ঘণ্টায় `email_send_log` (rolling, **কনজার্ভেটিভ**: Resend কখন রিসেট করে নিশ্চিত না)।
3. **provider মাসিক** `EMAIL_PROVIDER_MONTHLY_LIMIT` (৩০০০) − গত ৩০ দিনে।
4. **workspace দৈনিক** `workspaces.email_daily_limit` (ডিফল্ট ৫০) − আজ (Asia/Dhaka)।
5. **workspace মাসিক কোটা** = `plans.monthly_email_limit − email_messages_used_this_cycle − (scheduled/sending অবস্থায় আছে এমন)`।
   শেষ বন্ধনীটা "রিজার্ভেশন" — scheduler কখনো কোটার চেয়ে বেশি বসায় না, পাঠানো ব্যর্থ হলে রিজার্ভেশন আপনাআপনি ছাড়া পায়।

এগুলো একটাই DB ফাংশনে advisory lock-এর ভেতরে (provider-লেভেল lock + workspace-লেভেল lock), তাই একাধিক worker/ক্যাম্পেইন একসাথে চললেও ডাবল-বরাদ্দ হয় না।
**সীমা ছুঁলে**: বাকি recipient `pending` থাকে; `email_deferrals`-এ **(ক্যাম্পেইন, কারণ, দিন) প্রতি একটা রো** (প্রতি মিনিটে নতুন রো নয়, গণনা আপডেট হয়) — কারণ কোড:
`provider_daily_limit`, `provider_monthly_limit`, `workspace_daily_limit`, `workspace_quota_exhausted`, `domain_not_verified`, `sender_profile_incomplete`।
দৈনিক সীমা → পরদিন আপনাআপনি চলে। **মাসিক সীমা (provider বা workspace) ছুঁলে পরদিন কিছু বদলায় না** → ক্যাম্পেইন `paused` +
`paused_reason` + মালিক/অ্যাডমিনকে নোটিফিকেশন (চুপচাপ ঝুলে থাকবে না)।
ধীরগতি: প্রতি পাঠানোর `scheduled_at` ছড়ানো (প্রতি workspace-এ র‍্যান্ডম ছোট ব্যবধান) + worker-এ queue-wide limiter।
quiet hours ইমেইলে প্রয়োগ করছি না (ইমেইল অ্যাসিঙ্ক্রোনাস) — খোলা প্রশ্ন ৮।

## ১১) `createCampaign`-এর ভুল ইমেইলে কপি হচ্ছে না — কীভাবে
| WhatsApp-এ ভুল | ইমেইলে সমাধান (ফেজ ৩) |
|---|---|
| অডিয়েন্স কোয়েরিতে `.range()` নেই, ১০০০-এ চুপচাপ কেটে যেতে পারে | recipient তৈরি **DB-র ভেতরে একটা set-based `INSERT … SELECT`** (`create_email_campaign()`), PostgREST সীমা এড়িয়ে; `total_recipients` = আসলে ঢোকানো সংখ্যা |
| `messages` insert-এর এরর চেক হয় না | ফাংশন এরর raise করে, ক্যাম্পেইন ও recipients **একই transaction** — হয় সব, নয় কিছুই না; সার্ভার অ্যাকশন `error` পরীক্ষা করে ইউজারকে দেখায় |
| কোটা চেক ও insert-এর মাঝে lock নেই | একই ফাংশনের ভেতরে workspace-লেভেল advisory lock নিয়ে কোটা চেক + insert; দুটো ক্যাম্পেইন একসাথে তৈরি হলেও একটাই পাস করে |
| শুধু একটা ট্যাগে অডিয়েন্স | ফেজ ১-৩ এ একটা ট্যাগ বা সবাই (সরল); `audience_filter jsonb`/`segment_id` রিজার্ভ |
| কোটা ও পাঠানো আলাদা জায়গায় গোনা (Messenger বাগের মূল কারণ) | **গণনা একটাই জায়গায়** — `record_email_sent()` (নিচে) |

## ১২) কোটা — `record_email_sent()` (ফেজ ৩-এ; এখানে নকশা)
`record_email_sent(p_recipient_id, p_provider_message_id) returns boolean` — **একই transaction-এ**: recipient রো `FOR UPDATE` লক →
ইতিমধ্যে `sent` বা তার পরের হলে `false` (idempotent) → `status='sent'`, `sent_at`, `provider_message_id` → `email_campaign_stats.sent_count +1`
→ `workspaces.email_messages_used_this_cycle +1` → `email_send_log` এ ১ রো। অন্য কোথাও কখনো এই কাউন্টার বাড়ানো নিষিদ্ধ (কোড-রিভিউ নিয়ম)।
provider সফল হওয়ার পর worker এটা ডাকে; **এটা ব্যর্থ হলে** job throw করে retry হবে, কিন্তু provider-এর `Idempotency-Key` ২৪ ঘণ্টা ডাবল-পাঠানো আটকায়,
তাই retry নিরাপদ (Messenger-এর "গণনা ব্যর্থ হলে ডাবল-পাঠানোর ভয়ে throw করি না" সমস্যা এখানে নেই)।
সাইকেল: `email_cycle_started_at` + কাউন্টার `activateSubscription`-এ একসাথে রিসেট। প্ল্যানের মেয়াদ ৩০ দিনের বেশি হলে রোলওভার জব (ফেজ ৪) — আজকের সব প্ল্যান ≤৩০ দিন, তাই এখন দরকার নেই।
বিলিং পেজ/ড্যাশবোর্ডে ইমেইলের আলাদা লাইন ও মোটে যোগ (চ্যানেল-ভিত্তিক ভাগ, Messenger-এর মতোই; scheduler-এ ইমেইলের কোটা **আলাদাভাবে** প্রযোজ্য)।

## ১৩) ফেজ ১-এর পরিধি (বাস্তবায়নের তালিকা — অনুমোদনের পর)
`0054` ফাইল · `EmailProvider` + `ResendProvider` · Svix যাচাই · `/api/webhooks/email` + `email-webhook-events` queue + প্রসেসর ·
`email-domain-check` জব · সুপার-অ্যাডমিন ডোমেইন পেজ · `/dashboard/email/settings` (sender প্রোফাইল + Reply-To যাচাই) ·
unsubscribe টোকেন লাইব্রেরি + `/u/[token]` + হেডার/ফুটার বিল্ডার · টেস্ট-ইমেইল বোতাম (অ্যাডমিন, নিজের ঠিকানায়, দিনে ৫টা সীমা) ·
`NEXT_PUBLIC_EMAIL_ENABLED` flag, `nav-config.ts`-এ `email` চ্যানেল, `notifications`/TS union-এ `email`, env নাম ও Dockerfile/compose।
শেষে: web build + worker typecheck ক্লিন, আলাদা commit/push, এই ডকে অবস্থা ও টেস্টের ধাপ।

## ১৪) আমার জন্য টেস্টের ধাপ (ফেজ ১ শেষে)
1. Resend-এ অ্যাকাউন্ট, API key, **webhook endpoint (`https://<ডোমেইন>/api/webhooks/email`) + signing secret** নিন; `.env`-এ
   `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET` বসান; `NEXT_PUBLIC_EMAIL_ENABLED=true` (build লাগবে)।
2. `0054` চালান। অ্যাডমিন → "ইমেইল ডোমেইন" → সাবডোমেইন দিন → DNS তালিকা দেখুন।
3. DNS-এ SPF/DKIM/MX/DMARC বসিয়ে "যাচাই করুন" — প্রথমে ⏳/❌ আসাই স্বাভাবিক; কিছুক্ষণ পর সব ✅ ও `verified`।
4. DMARC **না** বসিয়ে যাচাই করুন → DMARC ❌, ডোমেইন verified নয় (গেট কাজ করছে)।
5. `/dashboard/email/settings`: From নাম, Reply-To, ব্যবসার নাম/ঠিকানা দিন → Reply-To-র কনফার্মেশন লিংক ক্লিক → "প্রস্তুত"।
6. টেস্ট ইমেইল (নিজের Gmail-এ): ইনবক্সে এসেছে? "Show original"-এ **SPF/DKIM/DMARC = PASS**, হেডারে `List-Unsubscribe` ও `List-Unsubscribe-Post`, ফুটারে ঠিকানা।
7. Gmail-এর উপরের "Unsubscribe" বোতাম বা ফুটার লিংক চাপুন → বাংলা+English পেজ; নিশ্চিত করলে `email_suppressions`-এ রো (reason `unsubscribed`)।
   লিংকটা আবার খুলুন → আবারও সফল পেজ, ডুপ্লিকেট রো নয়।
8. Resend-এ webhook ইভেন্ট (delivered/opened) এলে `email_events`-এ রো; একই ইভেন্ট আবার পাঠালে (Resend ড্যাশবোর্ডের "Resend") নতুন রো নয়।
9. ভুল signature দিয়ে `curl -X POST …/api/webhooks/email` → **401**; secret মুছে দিলে → **500** (200 নয়)।
10. flag `false` করলে ইমেইল সেকশন/রুট দেখা যায় না। কনসোল/worker লগে API key, ইমেইল ঠিকানা বা টোকেন-URL নেই তা নিশ্চিত করুন।

---

## ১৫) খোলা প্রশ্ন — আপনার অনুমোদন/সিদ্ধান্ত লাগবে (সুপারিশসহ)
| # | প্রশ্ন | সুপারিশ |
|---|---|---|
| ১ | ডোমেইন `verified` হতে **DMARC বাধ্যতামূলক** (নীতি `p=none` চলবে)? | হ্যাঁ — Gmail/Yahoo-র নিয়ম; `none` থেকে শুরু |
| ২ | Reply-To ঠিকানা কনফার্মেশন-লিংক দিয়ে যাচাই? | হ্যাঁ (ছদ্মবেশ ঠেকাতে; খরচ: কয়েকটা মেইল) |
| ৩ | প্ল্যানের ইমেইল সীমা: `monthly_email_limit` ও `email_contact_limit` কত? বিটায় provider মোট ৩০০০/মাস, ১০০/দিন — সব workspace মিলিয়ে | প্রস্তাব: Trial ৩০/মাস, Starter ৩০০, Pro ১০০০, Business ২০০০ (সংখ্যা আপনার সিদ্ধান্ত; বিটায় প্ল্যাটফর্ম সীমাই আসল সীমা) |
| ৪ | workspace দৈনিক ডিফল্ট `email_daily_limit` | ৫০ |
| ৫ | ইমেইলের ছবির বাকেট public-read (অনুমানযোগ্য নয় এমন uuid পাথ)? | হ্যাঁ (ইমেইল পরে খোলা হয়, signed URL মেয়াদ ফুরাবে) |
| ৬ | `email_recipients` partition করবো না, বদলে ৯০ দিনের আর্কাইভ স্ক্রিপ্ট (`messages` partition-ক্লিফের শিক্ষা — হাতে-বানানো partition ভুলে যাওয়ার ঝুঁকি) | হ্যাঁ; বড় স্কেলে (SES) আবার দেখবো |
| ৭ | অটো-পজ সীমা: bounce ≥৪% (≥৫০ পাঠানো), complaint ≥০.১% (≥২০০) | হ্যাঁ, Resend-এর নিজস্ব সীমা দেখে চূড়ান্ত |
| ৮ | ইমেইলে quiet hours প্রয়োগ হবে না | হ্যাঁ |
| ৯ | unsubscribe টোকেনে ইমেইল-ঠিকানা থাকবে (ডেটা মুছলেও কাজ করে) বনাম অস্বচ্ছ recipient-id (URL-এ PII নেই, কিন্তু recipient রো মুছলে লিংক অচল) | ঠিকানা-সহ টোকেন; URL কখনো লগে নয় |
| ১০ | `notifications` constraint-এ `email` যোগ (live টেবিল, `NOT VALID`+`VALIDATE`) | ঠিক আছে |
| ১১ | From-নাম ছদ্মবেশ (যেমন "bKash Support") — শেয়ার্ড ডোমেইনে একজনের অপব্যবহারে সবার সুনাম যায় | ফেজ ১-এ: নাম বদলের লগ + কিছু নিষিদ্ধ শব্দ (bkash, nagad, bank, gov) সতর্কতা/ব্লক — তালিকা আপনি অনুমোদন করবেন |
| ১২ | Resend ফ্রি প্ল্যানে মার্কেটিং/বাল্ক ইমেইল পাঠানোর নীতিগত অনুমতি | **আপনি আগে Resend-এর Acceptable Use/Terms দেখে নিন**; অনুমতি না থাকলে বিটা-provider বদলাতে হবে (interface থাকায় কোড-ক্ষতি কম) |
