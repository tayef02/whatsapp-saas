-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৯ — গ্রুপ থেকে সরাসরি (regex দিয়ে, AI লাগে না) অর্ডার
-- ক্যাপচার। কোন গ্রুপ থেকে অর্ডারটা এসেছে জানার জন্য orders টেবিলে group_id যোগ হচ্ছে।

alter table public.orders
  add column group_id uuid references public.groups (id) on delete set null;
