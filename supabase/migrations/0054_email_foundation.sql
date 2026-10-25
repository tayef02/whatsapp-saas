-- ইমেইল মার্কেটিং চ্যানেল — ফেজ ১ ভিত্তি (পরিকল্পনা: docs/email-plan.md)
--
-- WhatsApp/Messenger এর কোনো টেবিল এখানে ছোঁয়া হয়নি। শুধু একটা বিদ্যমান টেবিলে (notifications)
-- একটা CHECK বদল আছে — নিচের "লাইভ টেবিলের ঝুঁকি" দেখুন।
--
-- নতুন টেবিল (সবগুলোতে RLS চালু + স্পষ্ট GRANT + policy):
--   email_domains          — পাঠানোর ডোমেইন (বিটায় একটাই প্ল্যাটফর্ম ডোমেইন, workspace_id = NULL)
--   email_sender_profiles  — workspace-ভেদে From নাম, Reply-To, ব্যবসার নাম/ঠিকানা
--   email_suppressions     — যাদের আর কখনো ইমেইল পাঠানো যাবে না (workspace-ভিত্তিক, আলাদা)
--   email_events           — provider webhook ইভেন্ট (dedupe + অডিট)
--   email_send_log         — provider-লেভেলের দৈনিক/মাসিক সীমা গণনা (কোনো কনটেন্ট নেই)
-- নতুন ফাংশন: unsubscribe_email() — শুধু service_role চালাতে পারে।
--
-- ✔ কোনো serial/bigserial কলাম নেই (সব uuid) — তাই আলাদা sequence GRANT লাগে না (migration 0024
--   এর শিক্ষা)।
-- ✔ লেখার নিয়ম: email_domains / email_sender_profiles / email_suppressions এ ব্রাউজার (authenticated)
--   থেকে সরাসরি লেখা যায় না, শুধু SELECT। সব লেখা সার্ভার অ্যাকশন (service_role) দিয়ে, যেখানে
--   From-নামের ব্লক-তালিকা ও role যাচাই আগে হয় — নাহলে কেউ ব্রাউজার থেকে সরাসরি ব্লক-তালিকা
--   এড়িয়ে নাম বসিয়ে ফেলতে পারত।
--
-- ============================================================
-- ⚠ লাইভ টেবিলের ঝুঁকি
-- ============================================================
-- 1) notifications.channel এর CHECK বদল: পুরনো CHECK ড্রপ করে নতুনটা (whatsapp, messenger, email)
--    NOT VALID দিয়ে বসানো হয়, তারপর VALIDATE — VALIDATE লেখা আটকায় না। টেবিল ছোট, কয়েক
--    মিলিসেকেন্ডের কাজ। একই ট্রানজ্যাকশনে হওয়ায় "CHECK নেই" এমন কোনো মুহূর্ত বাইরে থেকে দেখা যায় না।
--    রোলব্যাক: নতুন CHECK ড্রপ করে আগেরটা (whatsapp, messenger) বসানো — 'email' চ্যানেলের রো না
--    থাকলে নিরাপদ।
-- 2) বাকি সবই নতুন টেবিল/ফাংশন — বিদ্যমান ডেটা বা অ্যাপের আচরণে প্রভাব নেই।
-- অ্যাপ কোড ডিপ্লয়ের আগে এই migration চালাতে হবে।

-- ============================================================
-- 1. email_domains
-- ============================================================
create table public.email_domains (
  id uuid primary key default gen_random_uuid(),
  -- NULL = প্ল্যাটফর্ম ডোমেইন (বিটায় সবাই এখান থেকে পাঠায়)। লঞ্চে workspace-এর নিজের ডোমেইনও
  -- এই টেবিলেই থাকবে (workspace_id বসানো রো)।
  workspace_id uuid references public.workspaces (id) on delete cascade,
  domain text not null check (domain = lower(domain) and length(domain) between 3 and 253),
  provider text not null default 'resend' check (provider in ('resend', 'ses')),
  provider_domain_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'suspended')),
  spf_status text not null default 'pending' check (spf_status in ('missing', 'pending', 'verified', 'failed')),
  dkim_status text not null default 'pending' check (dkim_status in ('missing', 'pending', 'verified', 'failed')),
  -- DMARC আমরা নিজে DNS থেকে দেখি (Resend এটা যাচাই করে কিনা ডকুমেন্টেশনে স্পষ্ট নয়)
  dmarc_status text not null default 'missing' check (dmarc_status in ('missing', 'present', 'invalid')),
  dmarc_policy text check (dmarc_policy in ('none', 'quarantine', 'reject')),
  -- দেখানোর জন্য DNS রেকর্ডের তালিকা: [{record, type, name, value, priority, status}]
  dns_records jsonb not null default '[]'::jsonb,
  -- From ঠিকানার স্থানীয় অংশ: hello → hello@<domain>
  from_local text not null default 'hello' check (from_local ~ '^[a-z0-9._-]{1,40}$'),
  -- প্রথমবার verified হওয়ার সময় = warm-up শুরুর ভিত্তি (পরে আবার verified হলেও বদলায় না)
  verified_at timestamptz,
  last_checked_at timestamptz,
  -- শুধু সংক্ষিপ্ত কোড/বার্তা — কখনো API key বা টোকেন নয়
  last_error text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index email_domains_domain_uidx on public.email_domains (lower(domain));
-- প্ল্যাটফর্মে (workspace_id null) একসাথে একটাই active ডোমেইন
create unique index email_domains_one_active_platform_uidx
  on public.email_domains ((true))
  where workspace_id is null and is_active;
create index email_domains_workspace_idx on public.email_domains (workspace_id) where workspace_id is not null;

alter table public.email_domains enable row level security;

-- কলাম-লেভেল SELECT: provider_domain_id ও last_error ব্রাউজারে যাবে না
grant select (
  id, workspace_id, domain, provider, status, spf_status, dkim_status, dmarc_status,
  dmarc_policy, dns_records, from_local, verified_at, last_checked_at, is_active, created_at
) on public.email_domains to authenticated;
grant select, insert, update, delete on public.email_domains to service_role;

-- প্ল্যাটফর্ম ডোমেইন (DNS তথ্য গোপন কিছু না) সবাই দেখবে — "প্ল্যাটফর্ম ডোমেইন যাচাই হয়েছে কিনা"
-- ব্যানারের জন্য; workspace-এর নিজের ডোমেইন শুধু সদস্যরা
create policy "email_domains_select" on public.email_domains
  for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. email_sender_profiles — workspace-ভেদে From নাম ও ব্যবসার তথ্য
-- ============================================================
create table public.email_sender_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  -- সক্রিয় (ব্যবহারযোগ্য) From নাম। ব্লক-তালিকায় পড়লে এখানে বসে না, নিচের requested_from_name এ
  -- থাকে এবং সুপার অ্যাডমিন অনুমোদন দিলে এখানে আসে
  from_name text check (from_name is null or length(from_name) between 1 and 60),
  from_name_status text not null default 'none' check (from_name_status in ('none', 'approved', 'pending_approval', 'rejected')),
  requested_from_name text check (requested_from_name is null or length(requested_from_name) between 1 and 60),
  from_name_block_reason text,
  from_name_reviewed_by uuid references auth.users (id) on delete set null,
  from_name_reviewed_at timestamptz,
  reply_to_email text,
  -- Reply-To ঠিকানা কনফার্মেশন লিংকে ক্লিক করলে এটা বসে; ঠিকানা বদলালে আবার null
  reply_to_verified_at timestamptz,
  reply_to_confirmation_sent_at timestamptz,
  -- ফুটারে বাধ্যতামূলক (Gmail/Yahoo-র নিয়ম ও আইনি সেরা-অনুশীলন)
  business_name text check (business_name is null or length(business_name) between 1 and 120),
  postal_address text check (postal_address is null or length(postal_address) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- অনুমোদনের অপেক্ষায় থাকা নামের তালিকা (সুপার অ্যাডমিন পেজ)
create index email_sender_profiles_pending_idx
  on public.email_sender_profiles (updated_at)
  where from_name_status = 'pending_approval';

alter table public.email_sender_profiles enable row level security;

grant select on public.email_sender_profiles to authenticated;
grant select, insert, update, delete on public.email_sender_profiles to service_role;

create policy "email_sender_profiles_select_member" on public.email_sender_profiles
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. email_suppressions — এই workspace-এ আর কখনো পাঠানো যাবে না
-- ============================================================
create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email_lower text not null check (email_lower = lower(email_lower) and length(email_lower) between 3 and 320),
  reason text not null check (reason in ('unsubscribed', 'hard_bounce', 'repeated_soft_bounce', 'complaint', 'manual')),
  source text not null check (source in ('unsubscribe_link', 'one_click', 'webhook', 'import', 'owner')),
  -- কোন ক্যাম্পেইন থেকে হয়েছিল (ফেজ ৩ এ email_campaigns এর FK যোগ হবে)
  campaign_id uuid,
  -- সংক্ষিপ্ত বিবরণ — ইমেইলের বডি বা সাবজেক্ট কখনো নয়
  detail text,
  created_at timestamptz not null default now(),
  unique (workspace_id, email_lower)
);

create index email_suppressions_workspace_created_idx on public.email_suppressions (workspace_id, created_at desc);

alter table public.email_suppressions enable row level security;

-- ব্রাউজার থেকে শুধু পড়া। unsubscribed/complaint মোছা যায় না — insert/update/delete শুধু service_role
grant select on public.email_suppressions to authenticated;
grant select, insert, update, delete on public.email_suppressions to service_role;

create policy "email_suppressions_select_member" on public.email_suppressions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. email_events — provider webhook ইভেন্ট
-- ============================================================
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  -- অজানা/টেস্ট মেসেজের ইভেন্টে null হতে পারে
  workspace_id uuid references public.workspaces (id) on delete cascade,
  -- ফেজ ৩ এ email_recipients এর FK যোগ হবে
  recipient_id uuid,
  provider text not null,
  -- Resend এ svix-id। (provider, provider_event_id) unique — একই ইভেন্ট দুইবার এলে ২য়বার কিছু হয় না
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  bounce_type text check (bounce_type in ('hard', 'soft')),
  -- শুধু দরকারি অংশ (bounce উপধরন, ক্লিক করা লিংকের ডোমেইন)। প্রাপকের ঠিকানা, সাবজেক্ট, বডি রাখা হয় না
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  process_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index email_events_workspace_created_idx on public.email_events (workspace_id, created_at desc);
create index email_events_message_idx on public.email_events (provider_message_id);
create index email_events_unprocessed_idx on public.email_events (created_at) where processed_at is null;

alter table public.email_events enable row level security;

grant select on public.email_events to authenticated;
grant select, insert, update, delete on public.email_events to service_role;

create policy "email_events_select_member" on public.email_events
  for select to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. email_send_log — provider-লেভেলের পাঠানো গণনা
-- ============================================================
-- দৈনিক (rolling ২৪ ঘণ্টা) ও মাসিক (rolling ৩০ দিন) provider সীমা এখান থেকে গোনা হয়। কনটেন্ট নেই,
-- শুধু "একটা ইমেইল গেছে"। কমপক্ষে ৩৫ দিন রাখতে হবে; পুরনো (৯০+ দিন) আর্কাইভ/মোছা যাবে।
create table public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  kind text not null check (kind in ('campaign', 'test', 'system')),
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- ফেজ ৩ এ email_recipients এর FK যোগ হবে
  recipient_id uuid,
  sent_at timestamptz not null default now()
);

create index email_send_log_sent_at_idx on public.email_send_log (sent_at);
create index email_send_log_workspace_kind_idx on public.email_send_log (workspace_id, kind, sent_at);

alter table public.email_send_log enable row level security;

grant select, insert, update, delete on public.email_send_log to service_role;
-- authenticated কে কোনো GRANT নেই; তবু স্পষ্ট policy যাতে "policy ছাড়া টেবিল" না থাকে
create policy "email_send_log_no_client_access" on public.email_send_log
  for all to authenticated
  using (false)
  with check (false);

-- ============================================================
-- 6. unsubscribe_email() — idempotent
-- ============================================================
-- নতুন suppression বসলে true, আগে থেকেই থাকলে (বা ঠিকানা ফাঁকা হলে) false। আগে অন্য কারণে
-- (যেমন bounce) suppressed থাকলে সেটাই থাকে, ওভাররাইট হয় না। (ফেজ ৩ এ create or replace করে এটা
-- pending recipients স্কিপ করবে ও stats বাড়াবে।)
create or replace function public.unsubscribe_email(
  p_workspace_id uuid,
  p_email text,
  p_campaign_id uuid,
  p_source text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_count integer;
begin
  if p_workspace_id is null or v_email = '' then
    return false;
  end if;

  insert into public.email_suppressions (workspace_id, email_lower, reason, source, campaign_id)
  values (p_workspace_id, v_email, 'unsubscribed', p_source, p_campaign_id)
  on conflict (workspace_id, email_lower) do nothing;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.unsubscribe_email(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.unsubscribe_email(uuid, text, uuid, text) to service_role;

-- ============================================================
-- 7. notifications.channel এ 'email' যোগ
-- ============================================================
-- পুরনো CHECK এর নাম নিশ্চিত না থাকলেও যেন কাজ করে — channel উল্লেখ করা সব CHECK খুঁজে ড্রপ
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%channel%'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.notifications
  add constraint notifications_channel_check
  check (channel in ('whatsapp', 'messenger', 'email')) not valid;

alter table public.notifications validate constraint notifications_channel_check;
