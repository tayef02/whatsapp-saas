-- Messenger চ্যানেল কাঠামো (Phase M0) — শুধু টেবিল/RLS, কোনো Messenger লজিক এখনো নেই।
-- WhatsApp এর কোনো টেবিল/কলাম এখানে ছোঁয়া হয়নি।
--
-- messenger_pages — প্রতিটা কানেক্ট করা Facebook পেজ একটা রো। whatsapp_numbers এর সাথে
-- ইচ্ছাকৃতভাবে আলাদা টেবিল (একসাথে করিনি) — কারণ:
--   ১. Messenger এর পরিচয় ভিন্ন (OAuth/Page Access Token, QR-কানেক্ট না)
--   ২. এই টেবিল আলাদা রাখলে WhatsApp এর বিদ্যমান RLS/কোয়েরি একদমই ছোঁয়া লাগে না
--   ৩. status এনাম WhatsApp এর (connecting/online/offline/banned) থেকে ইচ্ছাকৃতভাবে ভিন্ন —
--      Messenger এ QR স্ক্যানের মতো "connecting" নেই, কিন্তু token expire হওয়া একটা বাস্তব
--      অবস্থা যেটা WhatsApp এ নেই
create table public.messenger_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_id text not null,
  page_name text,
  -- আসল Page Access Token কখনো এই টেবিলে/কোনো প্লেইন কলামে সরাসরি রাখা হবে না — শুধু
  -- Supabase Vault এ সেভ করা secret এর id। workspace_ai_settings.api_key_secret_id এর
  -- ঠিক একই প্যাটার্ন (set_workspace_api_key/get_workspace_api_key RPC দেখুন)। Messenger এর
  -- নিজস্ব set_messenger_page_token/get_messenger_page_token RPC পরে M1 এ (পেজ কানেক্ট আসল
  -- লজিকের সাথে) যোগ হবে — এই migration এ শুধু কলামটা রাখা হলো, কোনো RPC/লজিক এখনো নেই।
  page_access_token_secret_id uuid,
  status text not null default 'active' check (status in ('active', 'token_expired', 'disconnected')),
  bot_enabled boolean not null default true,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, page_id)
);

create index messenger_pages_workspace_idx on public.messenger_pages (workspace_id);

alter table public.messenger_pages enable row level security;

-- বিদ্যমান টেবিলগুলোর (whatsapp_numbers, groups ইত্যাদি) ঠিক একই প্যাটার্ন —
-- is_workspace_member() helper (migration 0001) ব্যবহার করে
grant select, insert, update, delete on public.messenger_pages to authenticated, service_role;

create policy "messenger_pages_all_member" on public.messenger_pages
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- নোট: id/workspace_id সব uuid (gen_random_uuid()), কোনো bigserial/serial কলাম নেই —
-- তাই sequence এর জন্য আলাদা GRANT এর দরকার নেই (migration 0024 এর লেসন এখানে প্রযোজ্য না)।
