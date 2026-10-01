-- Phase M2: orders টেবিলে channel যোগ — Messenger চ্যাটেও এখন অর্ডার কনফার্ম হতে পারে।
-- ⚠️ orders লাইভ টেবিল (ব্যবহারকারীরা প্রতিদিন অর্ডার নিচ্ছেন) — কম-ট্রাফিকের সময় চালানোর
-- পরামর্শ। দুটোই additive/DEFAULT-সহ কলাম (metadata-only অপারেশন, কোনো টেবিল রিরাইট/লং লক না),
-- তাই দ্রুত শেষ হওয়ার কথা, কিন্তু সতর্কতা হিসেবে এখনও লো-ট্রাফিক সময়ে চালানো ভালো।
--
-- messenger_page_id এর FK messenger_pages টেবিল রেফার করে — orders.conversation_id কিন্তু
-- এখনও শুধু public.conversations (WhatsApp) রেফার করে, সেটা এই migration এ বদলানো হয়নি।
-- তাই Messenger থেকে আসা অর্ডারে conversation_id সবসময় null থাকবে (worker কোড এটা মানবে) —
-- নাহলে messenger_conversations.id ওখানে বসালে FK ভায়োলেশন হতো।
alter table public.orders
  add column channel text not null default 'whatsapp' check (channel in ('whatsapp', 'messenger')),
  add column messenger_page_id uuid references public.messenger_pages (id) on delete set null;

-- Orders পেজের চ্যানেল ফিল্টার + worker এর channel-scoped order-context লুকআপ (buildOrderContext)
-- দুটোরই জন্য দরকার — workspace_id প্রথমে (সবচেয়ে selective), তারপর channel
create index orders_workspace_channel_idx on public.orders (workspace_id, channel, created_at desc);

-- নোট: কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না। orders টেবিলের
-- বিদ্যমান GRANT/RLS policy (migration 0022) সব কলাম কভার করে, নতুন কলামের জন্য আলাদা কিছু
-- লাগে না (RLS রো-লেভেল, কলাম-লেভেল না)।
