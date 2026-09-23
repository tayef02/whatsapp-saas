-- মডিউল ১: Auth + Workspace (multi-tenant)
-- এই মাইগ্রেশনে ৩টা টেবিল: profiles, workspaces, workspace_members
-- Supabase-এ "Automatic expose new tables" বন্ধ আর "automatic RLS" চালু আছে,
-- তাই প্রতিটা টেবিলের জন্য এখানেই স্পষ্ট GRANT আর RLS policy লেখা হয়েছে।

create extension if not exists pgcrypto with schema extensions;

grant usage on schema public to authenticated, anon;

-- ============================================================
-- 1. profiles টেবিল — প্রতিটা auth user এর জন্য একটা profile row
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

-- ইউজার শুধু নিজের profile দেখতে/আপডেট করতে পারবে
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- signup এর সাথে সাথে অটো profile তৈরি হবে (নিচের ট্রিগার দেখুন),
-- কিন্তু app থেকে ইনসার্টের দরকার হলে যেন নিজেরটাই বসাতে পারে
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- নতুন auth.users সাইনআপ হলেই অটো profile বানানোর ফাংশন + ট্রিগার
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. workspaces টেবিল — প্রতিটা tenant/business একটা workspace
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- plan_id পরে (মডিউল ৭: প্ল্যান ও পেমেন্ট) plans টেবিলের FK হবে
  plan_id uuid,
  daily_message_limit integer not null default 200,
  created_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);

alter table public.workspaces enable row level security;

grant select, insert, update on public.workspaces to authenticated;

-- ============================================================
-- 3. workspace_members টেবিল — কোন ইউজার কোন workspace-এ কী রোলে আছে
-- ============================================================
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

alter table public.workspace_members enable row level security;

grant select, insert, update, delete on public.workspace_members to authenticated;

-- ============================================================
-- 4. Helper ফাংশন — workspace_members এর ওপর RLS সার্কুলার রেফারেন্স
-- এড়ানোর জন্য security definer ফাংশন। ভবিষ্যতের সব টেবিল
-- (contacts, templates, campaigns, ...) এই একই দুটো ফাংশন ব্যবহার করবে।
-- ============================================================
create function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

create function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ============================================================
-- 5. পলিসি — এখন যেহেতু দুটো টেবিল আর helper ফাংশন রেডি
-- ============================================================

-- ---- workspaces ----
create policy "workspaces_select_member" on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces_insert_self_owner" on public.workspaces
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "workspaces_update_owner" on public.workspaces
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---- workspace_members ----
create policy "members_select_same_workspace" on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- workspace বানানোর পরপরই নিজেকে owner হিসেবে যোগ করার bootstrap policy
create policy "members_insert_self_as_owner" on public.workspace_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- admin/owner পরে টিম মেম্বার যোগ করতে পারবে (phase 2: শেয়ার্ড ইনবক্স + টিম)
create policy "members_insert_by_admin" on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy "members_update_by_admin" on public.workspace_members
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "members_delete_by_admin" on public.workspace_members
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id));
