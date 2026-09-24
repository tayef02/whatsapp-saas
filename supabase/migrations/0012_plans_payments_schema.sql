-- মডিউল ৭: প্ল্যান ও পেমেন্ট — স্কিমা

-- ============================================================
-- 1. plans — দাম/লিমিট কোডে না, এখানে থাকবে
-- ============================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_bdt integer not null default 0,
  monthly_message_limit integer not null,
  contact_limit integer not null,
  max_numbers integer not null default 1,
  duration_days integer not null,
  is_trial boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- সবাই প্ল্যান/দাম দেখতে পারবে (pricing পেজ), শুধু service_role লিখতে পারবে
grant select on public.plans to authenticated;
grant select, insert, update, delete on public.plans to service_role;

create policy "plans_select_all" on public.plans
  for select to authenticated
  using (true);

-- ডিফল্ট প্ল্যান — এগুলো শুধু ডাটা, পরে SQL দিয়ে দাম/লিমিট বদলানো যাবে কোড না ছুঁয়েই
insert into public.plans (name, price_bdt, monthly_message_limit, contact_limit, max_numbers, duration_days, is_trial) values
  ('ট্রায়াল', 0, 100, 200, 1, 7, true),
  ('স্টার্টার', 990, 2000, 2000, 1, 30, false),
  ('প্রো', 2490, 10000, 10000, 3, 30, false),
  ('বিজনেস', 4990, 30000, 30000, 10, 30, false);

-- ============================================================
-- 2. workspaces এ সাবস্ক্রিপশন কলাম
-- মডিউল ৫ এ বসানো placeholder monthly_message_limit বাদ — plans.monthly_message_limit
-- দিয়ে রিপ্লেস হচ্ছে, দুই জায়গায় রাখলে কনফিউশন হতো
-- ============================================================
alter table public.workspaces drop column monthly_message_limit;

alter table public.workspaces
  add constraint workspaces_plan_id_fkey foreign key (plan_id) references public.plans (id),
  add column subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'expired')),
  add column subscription_started_at timestamptz,
  add column subscription_expires_at timestamptz,
  -- বর্তমান বিলিং সাইকেলে কতগুলো মেসেজ পাঠানো হয়েছে — নতুন পেমেন্ট approve হলে ০ তে রিসেট হয়
  add column messages_used_this_cycle integer not null default 0;

-- এই নতুন কলামগুলো ইচ্ছাকৃতভাবে authenticated এর GRANT এ নেই (migration 0011 এ
-- workspaces এ column-level GRANT বসানো হয়েছে, শুধু quiet_hours_* অনুমতি পাওয়া) —
-- তাই আলাদা করে কিছু করার দরকার নেই, নতুন কলাম ডিফল্টভাবেই সুরক্ষিত।

-- ============================================================
-- 3. payments
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  amount_bdt integer not null,
  provider text not null check (provider in ('bkash', 'nagad')),
  sender_phone text not null,
  transaction_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  -- একই provider এ একই transaction_id দুবার জমা দেওয়া যাবে না
  unique (provider, transaction_id)
);

create index payments_workspace_idx on public.payments (workspace_id, created_at desc);
create index payments_status_idx on public.payments (status);

alter table public.payments enable row level security;

grant select, insert on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

create policy "payments_select_own_or_admin" on public.payments
  for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_super_admin());

-- ইউজার নিজের workspace এর জন্য শুধু 'pending' স্ট্যাটাসে জমা দিতে পারবে —
-- সরাসরি 'approved' বসিয়ে অনুমোদনের ধাপ এড়িয়ে যাওয়া আটকানো হলো
create policy "payments_insert_own_pending" on public.payments
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and status = 'pending');

-- update (approve/reject) ইচ্ছাকৃতভাবে শুধু service_role — অ্যাডমিন প্যানেলের action
-- admin ক্লায়েন্ট দিয়ে চলবে, authenticated এর জন্য কোনো update policy নেই
