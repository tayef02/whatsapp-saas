-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৩ — নতুন মেম্বার জয়েন করলে কাস্টমাইজেবল ওয়েলকাম মেসেজ

alter table public.groups
  add column welcome_enabled boolean not null default false,
  add column welcome_message text;
