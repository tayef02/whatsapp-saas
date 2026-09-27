-- চ্যাটবট কথোপকথনে অর্ডার নিতে পারে, কিন্তু এখন পর্যন্ত পুরোটাই চ্যাট টেক্সট হিসেবে থেকে
-- যেত — কোনো structured রেকর্ড ছিল না। LLM অর্ডার কনফার্ম হলে একটা মার্কারসহ JSON ব্লক
-- আউটপুট করবে (worker সেটা পার্স করে এখানে সেভ করবে, কাস্টমারকে মার্কার দেখানো হয় না)।

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- conversation মুছে গেলেও অর্ডার রেকর্ড থেকে যাবে (ব্যবসার ডাটা, চ্যাট হিস্ট্রির চেয়ে গুরুত্বপূর্ণ)
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_phone text not null,
  product_name text,
  -- quantity ইচ্ছাকৃতভাবে text — LLM "২ পিস"/"2"/"দুইটা" যেভাবেই লিখুক, insert যেন কখনো
  -- টাইপ-মিসম্যাচে ব্যর্থ না হয়
  quantity text,
  delivery_name text,
  delivery_phone text,
  delivery_address text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'cancelled')),
  -- LLM এর আসল JSON ব্লক টেক্সট — পার্সিং ব্যর্থ হলেও এটা থেকে যায়, ডাটা হারায় না
  raw_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_workspace_idx on public.orders (workspace_id, created_at desc);
create index orders_status_idx on public.orders (workspace_id, status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

grant select, insert, update, delete on public.orders to authenticated, service_role;

create policy "orders_all_member" on public.orders
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
