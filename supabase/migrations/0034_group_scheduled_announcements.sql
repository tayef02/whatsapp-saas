-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৭ — শিডিউলড অ্যানাউন্সমেন্ট/পোল। একটা অ্যানাউন্সমেন্ট
-- একাধিক গ্রুপে টার্গেট করতে পারে, প্রতিটা গ্রুপে staggered delay সহ পাঠানো হয় (bulk/একসাথে
-- না — স্প্যাম-এর মতো আচরণ এড়াতে), আর প্রতি গ্রুপে দৈনিক সর্বোচ্চ সীমা মেনে চলে।

alter table public.groups
  add column max_daily_scheduled_messages integer not null default 3;

create table public.group_scheduled_announcements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_text text not null,
  -- poll_options থাকলে এটা পোল (message_text প্রশ্ন হিসেবে ব্যবহার হয়), না থাকলে সাধারণ টেক্সট
  poll_options text[],
  poll_multi_select boolean not null default false,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index group_scheduled_announcements_due_idx on public.group_scheduled_announcements (status, scheduled_at);
create index group_scheduled_announcements_workspace_idx on public.group_scheduled_announcements (workspace_id);

create trigger group_scheduled_announcements_set_updated_at
  before update on public.group_scheduled_announcements
  for each row execute function public.set_updated_at();

alter table public.group_scheduled_announcements enable row level security;

grant select, insert, update, delete on public.group_scheduled_announcements to authenticated, service_role;

create policy "group_scheduled_announcements_all_member" on public.group_scheduled_announcements
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table public.group_scheduled_announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.group_scheduled_announcements (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped_limit')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index group_scheduled_announcement_targets_ann_idx on public.group_scheduled_announcement_targets (announcement_id);
-- দৈনিক লিমিট চেক করার হট পাথ — প্রতিটা গ্রুপের আজকে কয়টা 'sent' target আছে গোনার জন্য
create index group_scheduled_announcement_targets_group_sent_idx on public.group_scheduled_announcement_targets (group_id, status, sent_at);

alter table public.group_scheduled_announcement_targets enable row level security;

grant select, insert, update, delete on public.group_scheduled_announcement_targets to authenticated, service_role;

create policy "group_scheduled_announcement_targets_all_member" on public.group_scheduled_announcement_targets
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
