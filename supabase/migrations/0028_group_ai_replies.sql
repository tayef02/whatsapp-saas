-- Phase ২: গ্রুপ ট্রিগার রিপ্লাই এখন fixed টেক্সটের পাশাপাশি AI (existing ১:১ চ্যাটবট কোর
-- reuse করে) দিয়েও উত্তর দিতে পারবে, আর keyword ছাড়াও @mention দিয়ে ট্রিগার করা যাবে।

alter table public.group_keyword_replies
  add column trigger_type text not null default 'keyword' check (trigger_type in ('keyword', 'mention')),
  add column reply_mode text not null default 'fixed' check (reply_mode in ('fixed', 'ai')),
  alter column keyword drop not null,
  alter column reply_text drop not null;

-- keyword ট্রিগারে keyword থাকতেই হবে, fixed মোডে reply_text থাকতেই হবে — বাকি কম্বিনেশনে
-- (mention ট্রিগার, বা AI মোড) সংশ্লিষ্ট ফিল্ড খালি থাকতে পারে
alter table public.group_keyword_replies
  add constraint group_keyword_replies_keyword_required
    check (trigger_type <> 'keyword' or keyword is not null),
  add constraint group_keyword_replies_reply_text_required
    check (reply_mode <> 'fixed' or reply_text is not null);

-- AI মোডে গ্রুপ-কনটেক্সট (কে কী বলেছে, শেষ কয়েকটা টার্ন) LLM কে দেওয়ার জন্য একটা ন্যূনতম
-- মেসেজ লগ দরকার। এখানে শুধু AI history এর জন্য প্রয়োজনীয় কলামগুলোই আছে — মিডিয়া/ডেলিভারি
-- স্ট্যাটাস/ড্যাশবোর্ড সার্চ পেজ (সাব-ফিচার #৪, "মেসেজ লগ/আর্কাইভ") পরে এই একই টেবিলে কলাম
-- যোগ করে সম্প্রসারণ করবে, নতুন টেবিল লাগবে না
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_phone text,
  sender_name text,
  content text not null,
  created_at timestamptz not null default now()
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);
create index group_messages_workspace_idx on public.group_messages (workspace_id);

alter table public.group_messages enable row level security;

grant select, insert, update, delete on public.group_messages to authenticated, service_role;

create policy "group_messages_all_member" on public.group_messages
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
