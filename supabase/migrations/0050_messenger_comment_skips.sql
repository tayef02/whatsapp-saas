-- Messenger কমেন্ট রিপ্লাইয়ে rate-limit (per-customer, per-page, drip-queue বয়স) আর "comment
-- still exists" চেক যোগ হলো — এগুলোর যেকোনো একটায় আটকালে কমেন্টটা একদম হারিয়ে যাওয়ার বদলে
-- এই নতুন "skip" লগে পড়বে, মালিক/দায়িত্বশীল পরে দেখে ম্যানুয়ালি পাঠাতে বা বাদ দিতে পারবেন।

-- ============================================================
-- 1. messenger_comments এ নতুন কলাম — rate-limit গণনার জন্য (কোন action নেওয়া হয়েছিল,
--    কখন queue তে বসানো হয়েছিল — এই দুটো না থাকলে "গত ১ ঘণ্টায় কতগুলো পাবলিক রিপ্লাই গেছে"
--    জাতীয় কাউন্ট করা যেত না)
-- ============================================================
alter table public.messenger_comments
  add column action text check (action in ('public_reply', 'private_reply')),
  add column queued_at timestamptz;

-- per-page-per-hour আর per-customer+post-per-hour কাউন্ট কোয়েরি দুটোর জন্যই দরকার
create index messenger_comments_page_action_queued_idx
  on public.messenger_comments (messenger_page_id, action, queued_at);
create index messenger_comments_psid_post_action_queued_idx
  on public.messenger_comments (from_psid, post_id, action, queued_at);

-- ============================================================
-- 2. messenger_comment_skips — রিভিউ লগ
-- ============================================================
create table public.messenger_comment_skips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  messenger_page_id uuid not null references public.messenger_pages (id) on delete cascade,
  comment_id text not null,
  post_id text,
  from_psid text,
  -- পুরো কমেন্টের লেখা না, শুধু সংক্ষিপ্ত অংশ (রিভিউয়ের জন্য প্রসঙ্গ বোঝা যথেষ্ট) — কখনো লগে
  -- প্রিন্ট হয় না, শুধু এই ডাটাবেস কলামে, workspace RLS দিয়ে সুরক্ষিত
  comment_text_excerpt text,
  matched_rule_id uuid references public.messenger_comment_rules (id) on delete set null,
  -- কোনো রুল না মিললে (rule_not_matched) action null থাকে
  action text check (action in ('public_reply', 'private_reply')),
  -- রুল ম্যাচ করে রিপ্লাই টেক্সট জেনারেট হওয়ার পর rate-limit এ আটকালে এখানে সেই টেক্সট সেভ
  -- থাকে — "এখন পাঠান" পেজে প্রি-ফিল হিসেবে দেখানো হবে (rule_not_matched এর ক্ষেত্রে null,
  -- কোনো রুলই ম্যাচ করেনি বলে জেনারেট করার কিছু ছিল না)
  reply_text text,
  reason text not null check (reason in (
    'cooldown_active', 'limit_per_customer', 'limit_per_page', 'rule_not_matched',
    'private_limit', 'comment_deleted', 'expired_7d', 'bot_disabled', 'reply_failed', 'queue_expired'
  )),
  status text not null default 'pending_review' check (status in ('pending_review', 'sent_manually', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index messenger_comment_skips_workspace_status_idx
  on public.messenger_comment_skips (workspace_id, status, created_at desc);
create index messenger_comment_skips_workspace_reason_idx
  on public.messenger_comment_skips (workspace_id, reason);
create index messenger_comment_skips_page_idx
  on public.messenger_comment_skips (messenger_page_id);

alter table public.messenger_comment_skips enable row level security;

grant select, insert, update, delete on public.messenger_comment_skips to authenticated, service_role;

create policy "messenger_comment_skips_all_member" on public.messenger_comment_skips
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- নোট: কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না।
