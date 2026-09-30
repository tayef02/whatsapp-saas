-- Messenger চ্যানেল কাঠামো (Phase M0), continued — কথোপকথন ও মেসেজ। WhatsApp এর
-- conversations/conversation_messages এর সাথে যতটা সম্ভব মিল রেখে বানানো হয়েছে (একই
-- status এনাম, একই dedup ইনডেক্স প্যাটার্ন — migration 0024)।
--
-- messenger_conversations WhatsApp এর contacts টেবিলের সাথে merge হয় না — Messenger এর
-- PSID (Page-Scoped ID) কোনো নির্ভরযোগ্য উপায়ে ফোন নাম্বারের সাথে মেলানো যায় না (Facebook
-- সাধারণত ফোন/ইমেইল দেয়ই না), তাই customer_name সরাসরি এই টেবিলেই রাখা হচ্ছে।
create table public.messenger_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  messenger_page_id uuid not null references public.messenger_pages (id) on delete cascade,
  psid text not null,
  customer_name text,
  status text not null default 'active' check (status in ('active', 'handed_off', 'resolved')),
  last_message_at timestamptz not null default now(),
  -- শুধু কাস্টমারের (ইনবাউন্ড) পাঠানো সর্বশেষ মেসেজের সময় — ২৪ ঘণ্টার মেসেজিং উইন্ডো হিসাব
  -- করার জন্য (bot/agent এর outbound রিপ্লাই এটা আপডেট করবে না)। আসল উইন্ডো-চেক লজিক M2 এ আসবে।
  last_user_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (messenger_page_id, psid)
);

create index messenger_conversations_workspace_recent_idx on public.messenger_conversations (workspace_id, last_message_at desc);

alter table public.messenger_conversations enable row level security;

grant select, insert, update, delete on public.messenger_conversations to authenticated, service_role;

create policy "messenger_conversations_all_member" on public.messenger_conversations
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- messenger_messages — এই টেবিলে নিজস্ব workspace_id কলাম নেই (conversation_messages এর
-- মতোই) — RLS তাই conversation_id দিয়ে messenger_conversations এ ঘুরে workspace যাচাই করে।
--
-- পারফরম্যান্স নোট: এটা conversation_messages এ আগে থেকেই থাকা একই প্যাটার্ন, প্রোডাকশনে
-- প্রমাণিত। messenger_messages_conv_idx (নিচে) থাকায় "একটা নির্দিষ্ট কথোপকথনের মেসেজ লিস্ট"
-- (ইনবক্স UI এর সবচেয়ে সাধারণ কোয়েরি) দ্রুতই থাকবে — conversation_id দিয়ে ইনডেক্স স্ক্যান,
-- তারপর RLS subquery তে messenger_conversations.id এর primary-key lookup। যেটা ধীর হতে
-- পারে: workspace_id ফিল্টার ছাড়া সরাসরি এই টেবিলে "পুরো workspace জুড়ে সব মেসেজ খুঁজুন"
-- জাতীয় কোয়েরি (যেমন কোনো ভবিষ্যৎ গ্লোবাল সার্চ ফিচার) — তখন RLS প্রতিটা রো এর জন্য
-- messenger_conversations এ join/subquery করবে, workspace_id কলাম সরাসরি থাকলে যা লাগত
-- না। ইনবক্স সবসময় conversation_id দিয়েই ফিল্টার করে (WhatsApp ইনবক্সের প্যাটার্নেই), তাই
-- বাস্তবে এটা সমস্যা হওয়ার কথা না — শুধু ভবিষ্যতে workspace-wide মেসেজ সার্চ বানাতে হলে এই
-- ট্রেড-অফ মাথায় রাখতে হবে।
create table public.messenger_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.messenger_conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'bot', 'agent')),
  content text not null default '',
  media_path text,
  media_type text check (media_type in ('image', 'document', 'video', 'audio')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  -- sender_type/direction একসাথে অসামঞ্জস্যপূর্ণ ডাটা (যেমন customer+outbound) insert হওয়া
  -- আটকাতে — conversation_messages এ এই কনস্ট্রেইন্ট নেই (ঐতিহাসিক কারণে), কিন্তু নতুন
  -- টেবিলে শুরু থেকেই রাখা ভালো
  constraint messenger_messages_direction_sender_check check (
    (sender_type = 'customer' and direction = 'inbound') or
    (sender_type in ('bot', 'agent') and direction = 'outbound')
  )
);

create index messenger_messages_conv_idx on public.messenger_messages (conversation_id, created_at);

-- dedup — conversation_messages_provider_msg_idx (migration 0024) এর ঠিক একই প্যাটার্ন,
-- একই webhook ইভেন্ট দুইবার এলে বা BullMQ retry হলে ডুপ্লিকেট মেসেজ/রিপ্লাই ঠেকাতে
create unique index messenger_messages_provider_msg_idx
  on public.messenger_messages (conversation_id, provider_message_id)
  where provider_message_id is not null;

alter table public.messenger_messages enable row level security;

grant select, insert, update, delete on public.messenger_messages to authenticated, service_role;

create policy "messenger_messages_all_member" on public.messenger_messages
  for all to authenticated
  using (exists (select 1 from public.messenger_conversations c where c.id = conversation_id and public.is_workspace_member(c.workspace_id)))
  with check (exists (select 1 from public.messenger_conversations c where c.id = conversation_id and public.is_workspace_member(c.workspace_id)));

-- নোট: এই migration এ কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না।
