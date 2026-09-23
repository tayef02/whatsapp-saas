-- মডিউল ৫: ক্যাম্পেইন — স্কিমা (টেবিল, partition, index, RLS)
-- ফাংশনগুলো (apply_message_status, scheduler) আলাদা migration 0010 এ

-- ============================================================
-- 0. workspaces / whatsapp_numbers এ নতুন কলাম
-- ============================================================
alter table public.workspaces
  add column quiet_hours_start_hour smallint not null default 22,
  add column quiet_hours_end_hour smallint not null default 9,
  -- মডিউল ৭ এ প্ল্যান অনুযায়ী মাসিক মেসেজ কোটা চেক এখানে বসবে, এখন null মানে আনলিমিটেড
  add column monthly_message_limit integer;

alter table public.whatsapp_numbers
  -- delay/লিমিট নাম্বার-ভিত্তিক (ক্যাম্পেইন-ভিত্তিক না) — একই নাম্বারে একাধিক
  -- ক্যাম্পেইন চললেও মোট গতি এই সীমার মধ্যেই থাকবে
  add column min_delay_seconds integer not null default 5,
  add column max_delay_seconds integer not null default 15;

-- ============================================================
-- 1. campaigns
-- ============================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_id uuid not null references public.templates (id),
  whatsapp_number_id uuid not null references public.whatsapp_numbers (id),
  name text not null,
  -- null মানে সব (opt-out বাদে) কন্টাক্ট, নাহলে নির্দিষ্ট ট্যাগ
  audience_tag text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'paused', 'cancelled', 'completed', 'failed')),
  paused_reason text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index campaigns_workspace_idx on public.campaigns (workspace_id, created_at desc);
create index campaigns_number_status_idx on public.campaigns (whatsapp_number_id, status);

alter table public.campaigns enable row level security;

grant select, insert, update, delete on public.campaigns to authenticated, service_role;

create policy "campaigns_select_member" on public.campaigns
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "campaigns_insert_member" on public.campaigns
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "campaigns_update_member" on public.campaigns
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "campaigns_delete_admin" on public.campaigns
  for delete to authenticated using (public.is_workspace_admin(workspace_id));

-- ============================================================
-- 2. messages — মাসভিত্তিক partition। partition টেবিলে PK এ অবশ্যই
-- partition key (created_at) থাকতে হয়, তাই (id, created_at) কম্পোজিট PK।
-- ============================================================
create table public.messages (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  whatsapp_number_id uuid not null references public.whatsapp_numbers (id),
  phone text not null,
  -- পাঠানোর ঠিক আগে spintax+variable resolve করে বসে (creation এ না, নাহলে
  -- সবাই একই spintax ভ্যারিয়েশন পেয়ে যাবে), তাই শুরুতে null থাকে
  rendered_content text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'unknown')),
  retry_count integer not null default 0,
  failed_reason text,
  provider_message_id text,
  scheduled_at timestamptz,
  -- Phase B (BullMQ তে ডিসপ্যাচ) একবারই হয়েছে কিনা ট্র্যাক করার জন্য, ডুপ্লিকেট এড়াতে
  enqueued_at timestamptz,
  claimed_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- আগামী কয়েক মাসের partition আগেই বানানো — cron মিস হলেও যেন insert fail না করে
create table public.messages_2026_09 partition of public.messages
  for values from ('2026-09-01') to ('2026-10-01');
create table public.messages_2026_10 partition of public.messages
  for values from ('2026-10-01') to ('2026-11-01');
create table public.messages_2026_11 partition of public.messages
  for values from ('2026-11-01') to ('2026-12-01');
create table public.messages_2026_12 partition of public.messages
  for values from ('2026-12-01') to ('2027-01-01');
create table public.messages_2027_01 partition of public.messages
  for values from ('2027-01-01') to ('2027-02-01');

-- সুরক্ষা জাল: ওপরের নির্দিষ্ট মাসের বাইরে পড়লেও (cron বন্ধ থাকলে) এখানে insert হবে,
-- fail হবে না। পরে এই ডাটা ঠিক মাসের partition এ সরিয়ে নেওয়া যায়।
create table public.messages_default partition of public.messages default;

-- campaign রিপোর্ট আর পোলিং এর জন্য
create index messages_campaign_status_idx on public.messages (campaign_id, status);
-- scheduler এর জন্য (কোন নাম্বারের কোন মেসেজ কখন পাঠানোর কথা)
create index messages_number_status_scheduled_idx on public.messages (whatsapp_number_id, status, scheduled_at);
-- Phase B: এখনো BullMQ তে না যাওয়া scheduled মেসেজ খুঁজে বের করার জন্য
create index messages_pending_dispatch_idx on public.messages (scheduled_at) where status = 'scheduled' and enqueued_at is null;
-- ওয়েবহুক delivered/read event এলে provider_message_id দিয়ে খুঁজবে
create index messages_provider_message_id_idx on public.messages (provider_message_id);
-- ১০ মিনিটের বেশি 'sending' আটকে থাকা মেসেজ খুঁজে বের করার জন্য
create index messages_claimed_at_idx on public.messages (claimed_at) where status = 'sending';

alter table public.messages enable row level security;

grant select, insert, update, delete on public.messages to authenticated, service_role;

create policy "messages_select_member" on public.messages
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- insert/update সবসময় worker/server action (service_role) করে, ইউজারের সরাসরি
-- লেখার দরকার নেই — কিন্তু consistency এর জন্য member-লেভেল পলিসি রাখা হলো
create policy "messages_insert_member" on public.messages
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "messages_update_member" on public.messages
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. campaign_stats
-- ============================================================
create table public.campaign_stats (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  read_count integer not null default 0,
  failed_count integer not null default 0,
  unknown_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.campaign_stats enable row level security;

grant select on public.campaign_stats to authenticated;
grant select, insert, update, delete on public.campaign_stats to service_role;

create policy "campaign_stats_select_member" on public.campaign_stats
  for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and public.is_workspace_member(c.workspace_id)));

-- ============================================================
-- 4. notifications (ইন-অ্যাপ)
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_workspace_idx on public.notifications (workspace_id, created_at desc);

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

create policy "notifications_select_member" on public.notifications
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- ইউজার শুধু is_read বদলাতে পারবে (পড়া হয়েছে মার্ক করা)
create policy "notifications_update_member" on public.notifications
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
