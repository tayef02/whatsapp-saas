-- মডিউল ৭ শুরুর আগে সিকিউরিটি ফিক্স:
-- ১. is_super_admin profiles টেবিলে রাখলে ইউজার নিজেই নিজেকে super admin বানিয়ে ফেলতে
--    পারত (profiles_update_own পলিসি id=auth.uid() হলেই allow করে, কলাম-নির্দিষ্ট না)।
--    তাই আলাদা super_admins টেবিল — authenticated এর কোনো GRANT নেই, শুধু service_role।
-- ২. workspaces এ এখন billing/limit কলাম আসছে (plan_id, subscription_*,
--    messages_used_this_cycle, ইত্যাদি)। আগে থেকেই "grant update on workspaces to
--    authenticated" (owner হলেই যেকোনো কলাম বদলানো যেত) দেওয়া ছিল, যেটা দিয়ে owner
--    নিজেই নিজের প্ল্যান/মেয়াদ বসিয়ে ফেলতে পারত। এখন কলাম-লেভেল GRANT দিয়ে শুধু
--    quiet_hours_* (সেটিংস পেজের বৈধ ব্যবহার) authenticated কে দেওয়া হলো, বাকি সব
--    কলাম শুধু service_role লিখতে পারবে।

-- ============================================================
-- 1. super_admins
-- ============================================================
create table public.super_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;
-- ইচ্ছাকৃতভাবে authenticated কে কোনো GRANT নেই — শুধু service_role (আমি নিজে SQL
-- Editor থেকে সরাসরি insert করব, অ্যাপের কোনো কোড থেকে এই টেবিলে লেখা হয় না)
grant select, insert, update, delete on public.super_admins to service_role;

-- ইউজার নিজে super admin কিনা চেক করতে পারবে, কিন্তু টেবিলের raw ডাটা দেখতে পারবে না —
-- শুধু true/false জানতে পারবে (is_workspace_member() এর মতোই safe peephole)
create function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- ============================================================
-- 2. workspaces কলাম-লেভেল GRANT — আগের ব্ল্যাঙ্কেট UPDATE বাতিল করে
-- শুধু quiet_hours_* authenticated কে দেওয়া হলো
-- ============================================================
revoke update on public.workspaces from authenticated;
grant update (quiet_hours_start_hour, quiet_hours_end_hour) on public.workspaces to authenticated;
