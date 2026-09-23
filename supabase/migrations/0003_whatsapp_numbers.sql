-- মডিউল ২: WhatsApp নাম্বার কানেক্ট
-- ২টা টেবিল: evolution_servers (infra, শুধু service_role অ্যাক্সেস করবে),
-- whatsapp_numbers (workspace ভিত্তিক, RLS আছে)
--
-- নোট: LANGUAGE SQL ফাংশন তৈরির সময় Postgres referenced টেবিল আছে কিনা যাচাই করে,
-- তাই আগে দুটো টেবিল বানিয়ে তারপর ফাংশন বানানো হয়েছে (আগের ভার্সনে এই অর্ডার ভুল ছিল)।
-- এই ফাইলটা বারবার চালালেও যেন এরর না দেয়, তাই শুরুতে IF EXISTS দিয়ে ড্রপ করা হয়েছে।

drop function if exists public.pick_least_loaded_server() cascade;
drop table if exists public.whatsapp_numbers cascade;
drop table if exists public.evolution_servers cascade;

-- ============================================================
-- 1. evolution_servers — কোন নাম্বার কোন Evolution সার্ভারে হোস্ট হচ্ছে
-- এই টেবিলে api_key এর মতো ইনফ্রা সিক্রেট থাকে, তাই ইচ্ছাকৃতভাবে
-- authenticated/anon কাউকে GRANT দেওয়া হয়নি — শুধু service_role
-- (worker আর server action এর admin client) এটা পড়তে/লিখতে পারবে,
-- যেটা Supabase এ ডিফল্টভাবেই RLS বাইপাস করে।
-- ============================================================
create table public.evolution_servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_url text not null,
  api_key text not null,
  capacity integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.evolution_servers enable row level security;
-- ইচ্ছাকৃতভাবে কোনো GRANT নেই — এই টেবিল শুধু service_role ব্যবহার করবে

-- ============================================================
-- 2. whatsapp_numbers — workspace এর কানেক্ট করা WhatsApp নাম্বার
-- ============================================================
create table public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  evolution_server_id uuid references public.evolution_servers (id),
  -- provider ফিল্ড: এখন শুধু evolution, ভারী ইউজারকে পরে meta তে সরানো যাবে শুধু এই ফিল্ড বদলে
  provider text not null default 'evolution' check (provider in ('evolution', 'meta')),
  instance_name text not null unique,
  phone_number text,
  display_name text,
  status text not null default 'connecting' check (status in ('connecting', 'online', 'offline', 'banned')),
  qr_code text,
  -- সেফটি: warmup + দৈনিক লিমিট কলাম, আসল লজিক ক্যাম্পেইন মডিউলে বসবে
  warmup_stage smallint not null default 1,
  daily_message_limit integer not null default 50,
  created_at timestamptz not null default now(),
  connected_at timestamptz
);

create index whatsapp_numbers_workspace_id_idx on public.whatsapp_numbers (workspace_id);
create index whatsapp_numbers_status_idx on public.whatsapp_numbers (status);

alter table public.whatsapp_numbers enable row level security;

grant select, insert, update, delete on public.whatsapp_numbers to authenticated;

create policy "numbers_select_member" on public.whatsapp_numbers
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "numbers_insert_member" on public.whatsapp_numbers
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "numbers_update_member" on public.whatsapp_numbers
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "numbers_delete_admin" on public.whatsapp_numbers
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

-- ============================================================
-- 3. সবচেয়ে কম-লোড, active সার্ভার বাছাই করার ফাংশন
-- এখন whatsapp_numbers টেবিল আগে থেকেই আছে, তাই এই ফাংশন তৈরি হতে সমস্যা হবে না।
-- নতুন সার্ভার যোগ করতে কোড বদলানো লাগবে না, শুধু evolution_servers এ একটা row অ্যাড করলেই হবে।
-- ============================================================
create function public.pick_least_loaded_server()
returns public.evolution_servers
language sql
security definer
stable
set search_path = public
as $$
  select es.*
  from public.evolution_servers es
  left join public.whatsapp_numbers wn
    on wn.evolution_server_id = es.id and wn.status <> 'banned'
  where es.is_active = true
  group by es.id
  having count(wn.id) < es.capacity
  order by count(wn.id) asc
  limit 1;
$$;
