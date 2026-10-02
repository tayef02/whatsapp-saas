-- Messenger মেসেজের মাসিক ব্যবহার গণনা (শুধু গণনা ও দেখানো — কোনো আটকানো/সীমা-বাধ্যতা নেই)।
--
-- সিদ্ধান্ত (ইউজার অনুমোদিত):
--   • WhatsApp এর বিদ্যমান messages_used_this_cycle কলাম ও apply_message_status হিসাব অপরিবর্তিত
--     (তাই ডাবল-কাউন্ট নেই)।
--   • ক্যাম্পেইন scheduler (schedule_number_messages) এর শর্ত অপরিবর্তিত — সে এখনো শুধু
--     WhatsApp এর কাউন্টার বনাম প্ল্যানের মাসিক সীমা দেখে।
--   • Messenger রিপ্লাই কোটা/মেয়াদের কারণে কখনো আটকায় না — এটা শুধু হিসাব।
--   • পুরনো ব্যবহারের ব্যাকফিল নেই, কাউন্টার ০ থেকে শুরু।
--
-- কী গোনা হয় (worker থেকে, প্রোভাইডার সফল হওয়ার ঠিক পরে): বট ও এজেন্টের ইনবক্স রিপ্লাই (অর্ডার
-- স্ট্যাটাস নোটিফিকেশনসহ), পাবলিক কমেন্ট রিপ্লাই, প্রাইভেট কমেন্ট রিপ্লাই (একবারই)।
--
-- GRANT/RLS: নতুন টেবিল নেই। workspaces এ 0011 থেকে কলাম-লেভেল UPDATE GRANT (authenticated
-- শুধু quiet_hours_*) — তাই নতুন কলাম ইউজার নিজে বদলাতে পারবে না (নিজের কাউন্টার ০ করা যাবে
-- না), শুধু service_role। SELECT টেবিল-লেভেল GRANT এ আগে থেকেই আছে, তাই নতুন কলাম member রা
-- নিজের workspace এর দেখতে পাবে (বিলিং/ড্যাশবোর্ড পেজের জন্য)।
--
-- ============================================================
-- ⚠ লাইভ টেবিলের ঝুঁকি
-- ============================================================
-- ADD COLUMN ... NOT NULL DEFAULT 0 — ধ্রুব ডিফল্ট, PostgreSQL 11+ এ টেবিল রিরাইট হয় না (তাৎক্ষণিক,
-- শুধু সংক্ষিপ্ত ACCESS EXCLUSIVE লক)। workspaces ছোট টেবিল (প্রতি ব্যবসায় একটা রো)। রোলব্যাক:
-- drop function + alter table ... drop column (শুধু এই গণনার মান যায়)। অ্যাপ কোড ডিপ্লয়ের আগে
-- চালাতে হবে, নাহলে বিলিং/ড্যাশবোর্ডের কোয়েরি "column does not exist" দেবে।

alter table public.workspaces
  add column messenger_messages_used_this_cycle integer not null default 0;

-- অ্যাটমিক ইনক্রিমেন্ট — PostgREST থেকে "x = x + 1" লেখা যায় না, তাই RPC। security definer +
-- স্থির search_path; শুধু service_role (worker) চালাতে পারবে, authenticated/anon নয়।
create or replace function public.increment_messenger_messages_used(
  p_workspace_id uuid,
  p_count integer default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_count is null or p_count <= 0 then
    return;
  end if;

  update public.workspaces
  set messenger_messages_used_this_cycle = messenger_messages_used_this_cycle + p_count
  where id = p_workspace_id;
end;
$$;

revoke all on function public.increment_messenger_messages_used(uuid, integer) from public;
grant execute on function public.increment_messenger_messages_used(uuid, integer) to service_role;
