-- মডিউল ৩: কন্টাক্ট ম্যানেজমেন্ট

-- মডিউল ৭ (প্ল্যান ও পেমেন্ট) এ ব্যবহারের জন্য জায়গা — এখনই enforce হচ্ছে না,
-- null মানে এখন আনলিমিটেড, প্ল্যান সিস্টেম আসলে এখানে সংখ্যা বসবে
alter table public.workspaces add column contact_limit integer;

-- ============================================================
-- 1. contacts
-- ============================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- নরমালাইজড ফরম্যাটে সেভ হয় (8801XXXXXXXXX), normalizeBangladeshiPhone() দিয়ে
  phone text not null,
  name text,
  tags text[] not null default '{}',
  -- import এর সময় phone/name বাদে বাকি কলাম এখানে জমা হয় (city, order_id, ...)
  -- পরে টেমপ্লেটে {{city}} এর মতো ভেরিয়েবল হিসেবে ব্যবহার করা যাবে
  custom_fields jsonb not null default '{}',
  -- সেফটি নিয়ম: কেউ STOP লিখলে এটা true হবে, ক্যাম্পেইন মডিউলে আর মেসেজ যাবে না
  opted_out boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

-- pagination সহ লিস্ট লোড আর ডুপ্লিকেট চেক দ্রুত করার জন্য
create index contacts_workspace_created_idx on public.contacts (workspace_id, created_at desc);
create index contacts_tags_idx on public.contacts using gin (tags);

alter table public.contacts enable row level security;

grant select, insert, update, delete on public.contacts to authenticated, service_role;

create policy "contacts_select_member" on public.contacts
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "contacts_insert_member" on public.contacts
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "contacts_update_member" on public.contacts
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "contacts_delete_member" on public.contacts
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. contact_imports — বড় ফাইল ব্যাকগ্রাউন্ডে (worker) প্রসেস হওয়ার সময়
-- প্রগ্রেস ট্র্যাক করার জন্য। ছোট ফাইল সরাসরি প্রসেস হয়, এই টেবিলে শুধু
-- লগ রাখা হয় (audit + UI status পোলিং এর জন্য)।
-- ============================================================
create table public.contact_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  added_count integer not null default 0,
  duplicate_count integer not null default 0,
  invalid_count integer not null default 0,
  error_message text,
  applied_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index contact_imports_workspace_idx on public.contact_imports (workspace_id, created_at desc);

alter table public.contact_imports enable row level security;

-- worker/server action সবসময় service_role দিয়ে লেখে, ইউজার শুধু নিজের workspace এর
-- import history/progress দেখতে পারবে (পোলিং এর জন্য)
grant select on public.contact_imports to authenticated;
grant select, insert, update, delete on public.contact_imports to service_role;

create policy "contact_imports_select_member" on public.contact_imports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. Storage bucket — বড় ফাইল worker প্রসেস করার আগে সাময়িক রাখার জন্য।
-- এটা শুধু service_role (server action + worker) ব্যবহার করে, তাই authenticated
-- এর জন্য আলাদা storage policy লাগছে না।
-- ============================================================
insert into storage.buckets (id, name, public)
values ('contact-imports', 'contact-imports', false)
on conflict (id) do nothing;
