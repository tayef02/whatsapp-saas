-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৫ — workspace-ভিত্তিক ব্যানড-ওয়ার্ড/লিংক-প্যাটার্ন লিস্ট।
-- মিলে গেলে bot-এর delete permission (গ্রুপে অ্যাডমিন কিনা) থাকলে auto-delete, না থাকলে
-- admin-কে ড্যাশবোর্ড নোটিফিকেশন।

create table public.workspace_group_filters (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  banned_words text[] not null default '{}',
  banned_link_patterns text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspace_group_filters_set_updated_at
  before update on public.workspace_group_filters
  for each row execute function public.set_updated_at();

alter table public.workspace_group_filters enable row level security;

grant select, insert, update, delete on public.workspace_group_filters to authenticated, service_role;

create policy "workspace_group_filters_all_member" on public.workspace_group_filters
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
