-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৬ — প্রতি গ্রুপে টগল: চালু থাকলে শুধু অ্যাডমিনরাই
-- মেসেজ পাঠাতে পারবে (Evolution/Baileys এর "announcement" গ্রুপ সেটিং)

alter table public.groups
  add column is_admin_only_mode boolean not null default false;
