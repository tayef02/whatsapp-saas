-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ২ — কিওয়ার্ড-বেসড অটো-রিপ্লাই (per-group), একই
-- কিওয়ার্ডে বারবার ট্রিগার আটকাতে per-keyword cooldown (last_triggered_at)

create table public.group_keyword_replies (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  keyword text not null,
  reply_text text not null,
  cooldown_seconds integer not null default 300,
  is_active boolean not null default true,
  -- এই টাইমস্ট্যাম্প atomically update করেই cooldown চেক+সেট হয় (worker এ একটা conditional
  -- UPDATE...WHERE...RETURNING দিয়ে) — একই মেসেজ দুইবার webhook এলেও ডুপ্লিকেট রিপ্লাই যাবে না
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index group_keyword_replies_group_idx on public.group_keyword_replies (group_id);
create index group_keyword_replies_workspace_idx on public.group_keyword_replies (workspace_id);

create trigger group_keyword_replies_set_updated_at
  before update on public.group_keyword_replies
  for each row execute function public.set_updated_at();

alter table public.group_keyword_replies enable row level security;

grant select, insert, update, delete on public.group_keyword_replies to authenticated, service_role;

create policy "group_keyword_replies_all_member" on public.group_keyword_replies
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
