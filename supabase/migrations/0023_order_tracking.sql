-- অর্ডার সিস্টেমের ৪টা সংযোজন:
-- ১. ছোট readable order_number (কাস্টমারকে জানানোর জন্য, UUID না)
-- ২. whatsapp_number_id (status-update মেসেজ কোন নাম্বার থেকে পাঠানো হবে জানার জন্য)
-- ৩. cancel_reason (বাতিল করার কারণ)
-- ৪. order_status_history টেবিল (কবে কোন status এ গিয়েছিল তার লগ)

alter table public.orders
  add column order_number bigserial,
  add column whatsapp_number_id uuid references public.whatsapp_numbers (id) on delete set null,
  add column cancel_reason text;

-- এই migration এর আগে তৈরি অর্ডারের জন্য conversation থেকে নাম্বার ব্যাকফিল
update public.orders o
set whatsapp_number_id = c.whatsapp_number_id
from public.conversations c
where o.conversation_id = c.id
  and o.whatsapp_number_id is null;

create unique index orders_order_number_idx on public.orders (order_number);

-- worker প্রতিটা ইনকামিং মেসেজে এই ফোন নাম্বারের সাম্প্রতিক অর্ডার খোঁজে (LLM কে
-- context হিসেবে দেওয়ার জন্য) — এটা হট পাথ, তাই কম্পোজিট index দরকার
create index orders_workspace_phone_idx on public.orders (workspace_id, contact_phone, created_at desc);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

alter table public.order_status_history enable row level security;

grant select, insert on public.order_status_history to authenticated, service_role;

create policy "order_status_history_all_member" on public.order_status_history
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
