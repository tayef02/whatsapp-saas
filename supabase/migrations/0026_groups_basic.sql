-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ১ — বেসিক গ্রুপ ম্যানেজমেন্ট। Evolution API থেকে
-- গ্রুপের নাম/বর্ণনা/মেম্বার/অ্যাডমিন লিস্ট sync করে ড্যাশবোর্ডে দেখানো, আর ইনভাইট লিংক
-- জেনারেট/রোটেট করা। পরের সাব-ফিচার (কিওয়ার্ড রিপ্লাই, welcome, admin-only mode ইত্যাদি)
-- আলাদা migration-এ নিজের কলাম/টেবিল যোগ করবে।

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  whatsapp_number_id uuid not null references public.whatsapp_numbers (id) on delete cascade,
  group_jid text not null,
  name text,
  description text,
  member_count integer not null default 0,
  invite_code text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index groups_number_jid_idx on public.groups (whatsapp_number_id, group_jid);
create index groups_workspace_idx on public.groups (workspace_id);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

alter table public.groups enable row level security;

grant select, insert, update, delete on public.groups to authenticated, service_role;

create policy "groups_all_member" on public.groups
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- গ্রুপ মেম্বার লিস্ট (sync করলে পুরনো লিস্ট মুছে নতুন করে বসানো হয় — Evolution ই source of truth)
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  phone text not null,
  name text,
  is_group_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index group_members_group_phone_idx on public.group_members (group_id, phone);
create index group_members_workspace_idx on public.group_members (workspace_id);

alter table public.group_members enable row level security;

grant select, insert, update, delete on public.group_members to authenticated, service_role;

create policy "group_members_all_member" on public.group_members
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
