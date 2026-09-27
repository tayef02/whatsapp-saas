-- Phase ২: WhatsApp গ্রুপ টুলস, ধাপ ৮ — inactive/স্প্যাম মেম্বার auto-flag। কখনো auto-remove
-- করা হয় না, শুধু ড্যাশবোর্ডে flagged দেখানো হয় — remove করার সিদ্ধান্ত admin নিজে WhatsApp এ
-- গিয়ে ম্যানুয়ালি নেবে।

alter table public.group_members
  add column last_activity_at timestamptz,
  add column is_flagged boolean not null default false,
  add column flag_reason text;
