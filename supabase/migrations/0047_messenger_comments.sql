-- Phase ৩ (M3): Messenger কমেন্ট অটোমেশন — WhatsApp গ্রুপের group_keyword_replies (migration
-- 0027-0028) এর কাঠামো/cooldown-লজিক হুবহু কপি করা হয়েছে, শুধু messenger_page_id-ভিত্তিক আর
-- action কলাম নতুন (public_reply | private_reply) — "নিবো/ইনবক্স" ধরনের কিওয়ার্ডও একটা
-- সাধারণ রুল হিসেবেই ম্যানেজ করা যায়, কোনো হার্ডকোডেড কিওয়ার্ড লিস্ট কোডে নেই।
--
-- ⚠️ দুটোই নতুন টেবিল, কোনো বিদ্যমান টেবিল ছোঁয়া হয়নি — ঝুঁকি কম।

-- ============================================================
-- 1. messenger_comment_rules
-- ============================================================
create table public.messenger_comment_rules (
  id uuid primary key default gen_random_uuid(),
  messenger_page_id uuid not null references public.messenger_pages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 'keyword' হলে comment_text এ keyword সাবস্ট্রিং মিলতে হবে, 'all' হলে এই পেজের প্রতিটা
  -- নতুন কমেন্টেই ম্যাচ করবে (একাধিক rule থাকলে array-এর প্রথমটা জেতে, WhatsApp গ্রুপের
  -- ঠিক একই আচরণ)
  trigger_type text not null default 'keyword' check (trigger_type in ('keyword', 'all')),
  keyword text,
  -- public_reply = কমেন্টের নিচেই পাবলিক রিপ্লাই। private_reply = Messenger Private Reply API
  -- দিয়ে কাস্টমারের ইনবক্সে পাঠানো (সফল হলে messenger_conversations/messenger_messages এ
  -- স্বাভাবিক কথোপকথনের মতোই সেভ হয়, ইনবক্সে দেখা যাবে) — Meta নিয়ম: প্রতি কমেন্টে একবারই,
  -- সেটা comment_id এর dedup (নিচে messenger_comments) দিয়েই স্বয়ংক্রিয়ভাবে নিশ্চিত হয়
  action text not null default 'public_reply' check (action in ('public_reply', 'private_reply')),
  reply_mode text not null default 'fixed' check (reply_mode in ('fixed', 'ai')),
  -- spintax ({Hi|Hello} স্টাইল) সাপোর্ট করে, send এর সময় resolveSpintax() দিয়ে রেজলভ হয় —
  -- বিজ্ঞাপনের নিচে অনেক একই-রকম কমেন্টে বারবার হুবহু একই রিপ্লাই গেলে স্প্যাম-ঝুঁকি বাড়ে
  reply_text text,
  cooldown_seconds integer not null default 300,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messenger_comment_rules_keyword_required check (trigger_type <> 'keyword' or keyword is not null),
  constraint messenger_comment_rules_reply_text_required check (reply_mode <> 'fixed' or reply_text is not null)
);

create index messenger_comment_rules_page_idx on public.messenger_comment_rules (messenger_page_id);
create index messenger_comment_rules_workspace_idx on public.messenger_comment_rules (workspace_id);

create trigger messenger_comment_rules_set_updated_at
  before update on public.messenger_comment_rules
  for each row execute function public.set_updated_at();

alter table public.messenger_comment_rules enable row level security;

grant select, insert, update, delete on public.messenger_comment_rules to authenticated, service_role;

create policy "messenger_comment_rules_all_member" on public.messenger_comment_rules
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. messenger_comments — লগ (প্রতিটা ইনকামিং কমেন্ট, ম্যাচ/রিপ্লাই হোক বা না হোক)
-- ============================================================
create table public.messenger_comments (
  id uuid primary key default gen_random_uuid(),
  messenger_page_id uuid not null references public.messenger_pages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  comment_id text not null,
  post_id text,
  from_psid text,
  from_name text,
  comment_text text not null default '',
  matched_rule_id uuid references public.messenger_comment_rules (id) on delete set null,
  reply_sent boolean not null default false,
  reply_text text,
  -- কমেন্টে ফোন নাম্বার লিখলে লিড হিসেবে ফ্ল্যাগ — আলাদা টেবিল না, এই লগেই রাখা হচ্ছে
  is_lead boolean not null default false,
  lead_phone text,
  created_at timestamptz not null default now()
);

-- dedup — একই comment_id দুইবার webhook এ এলে (Meta রিট্রাই, বা BullMQ job retry) দ্বিতীয়বার
-- প্রসেস/রিপ্লাই না হয়
create unique index messenger_comments_dedup_idx on public.messenger_comments (messenger_page_id, comment_id);
create index messenger_comments_workspace_recent_idx on public.messenger_comments (workspace_id, created_at desc);

alter table public.messenger_comments enable row level security;

grant select, insert, update, delete on public.messenger_comments to authenticated, service_role;

create policy "messenger_comments_all_member" on public.messenger_comments
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- নোট: কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না।
