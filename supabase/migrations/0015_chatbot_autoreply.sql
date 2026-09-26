-- মডিউল ৮: Keyword-ভিত্তিক Auto-Reply (কোনো AI/LLM কল নেই, শুধু keyword ম্যাচ করে
-- প্রি-সেট reply পাঠানো)। conversations/conversation_messages টেবিল দুটো পরে Phase ২ এর
-- শেয়ার্ড ইনবক্সেও কাজে লাগবে।

-- ইনকামিং মেসেজ থেকে conversation বানাতে হলে contact লাগে — যে নাম্বার থেকে মেসেজ এসেছে
-- সেটা কন্টাক্ট লিস্টে না থাকলে এখন অটো-তৈরি হবে (source='inbound')
alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check check (source in ('manual', 'import', 'inbound'));

-- ============================================================
-- 1. chatbot_configs — প্রতিটা নাম্বারের নিজস্ব auto-reply সেটিংস
-- ============================================================
create table public.chatbot_configs (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number_id uuid not null unique references public.whatsapp_numbers (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  is_active boolean not null default true,
  welcome_message text,
  -- কোনো rule না মিললে এটা পাঠানো হবে, আর conversation human handoff এ চলে যাবে
  fallback_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chatbot_configs_set_updated_at
  before update on public.chatbot_configs
  for each row execute function public.set_updated_at();

alter table public.chatbot_configs enable row level security;

grant select, insert, update, delete on public.chatbot_configs to authenticated, service_role;

create policy "chatbot_configs_all_member" on public.chatbot_configs
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. chatbot_rules — keyword → reply, priority অনুযায়ী (ছোট নাম্বার আগে চেক হয়)
-- ============================================================
create table public.chatbot_rules (
  id uuid primary key default gen_random_uuid(),
  chatbot_config_id uuid not null references public.chatbot_configs (id) on delete cascade,
  keyword text not null,
  match_type text not null default 'contains' check (match_type in ('contains', 'exact')),
  -- টেমপ্লেটের মতোই {{name}}/spintax সাপোর্ট করবে, renderMessage() দিয়ে
  reply_text text not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index chatbot_rules_config_priority_idx on public.chatbot_rules (chatbot_config_id, priority);

alter table public.chatbot_rules enable row level security;

grant select, insert, update, delete on public.chatbot_rules to authenticated, service_role;

create policy "chatbot_rules_all_member" on public.chatbot_rules
  for all to authenticated
  using (exists (
    select 1 from public.chatbot_configs cc
    where cc.id = chatbot_config_id and public.is_workspace_member(cc.workspace_id)
  ))
  with check (exists (
    select 1 from public.chatbot_configs cc
    where cc.id = chatbot_config_id and public.is_workspace_member(cc.workspace_id)
  ));

-- ============================================================
-- 3. conversations — প্রতিটা কন্টাক্টের সাথে চলমান কথোপকথনের অবস্থা
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  whatsapp_number_id uuid not null references public.whatsapp_numbers (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- active: bot/agent স্বাভাবিক জবাব দিচ্ছে, handed_off: এজেন্টের অপেক্ষায় (bot চুপ),
  -- resolved: এজেন্ট বন্ধ করে দিয়েছে (পরের মেসেজে আবার active হয়ে যাবে)
  status text not null default 'active' check (status in ('active', 'handed_off', 'resolved')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (whatsapp_number_id, contact_id)
);

create index conversations_workspace_recent_idx on public.conversations (workspace_id, last_message_at desc);

alter table public.conversations enable row level security;

grant select, insert, update, delete on public.conversations to authenticated, service_role;

create policy "conversations_all_member" on public.conversations
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. conversation_messages — পুরো কথোপকথনের ইতিহাস
-- ============================================================
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'bot', 'agent')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);

alter table public.conversation_messages enable row level security;

grant select, insert, update, delete on public.conversation_messages to authenticated, service_role;

create policy "conversation_messages_all_member" on public.conversation_messages
  for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_workspace_member(c.workspace_id)
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_workspace_member(c.workspace_id)
  ));
