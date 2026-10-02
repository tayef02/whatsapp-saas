-- আগে messenger_comment_rules.last_triggered_at দিয়ে পুরো রুলের জন্য একটাই global cooldown
-- ছিল — একজন কাস্টমার রিপ্লাই পেলে পরের cooldown_seconds সময়ে অন্য যেকোনো কাস্টমার একই
-- কিওয়ার্ডে কমেন্ট করলেও রিপ্লাই পেত না (ইউজার রিপোর্ট করার পর ধরা পড়েছে)। এখন প্রতিটা
-- (rule, commenter/from_psid) জোড়ার নিজস্ব আলাদা cooldown — এক কাস্টমারের রিপ্লাই অন্য
-- কাস্টমারকে আটকাবে না, শুধু একই কাস্টমার বারবার কমেন্ট করলে rate-limit হবে।

create table public.messenger_comment_rule_cooldowns (
  rule_id uuid not null references public.messenger_comment_rules (id) on delete cascade,
  from_psid text not null,
  last_triggered_at timestamptz not null default now(),
  primary key (rule_id, from_psid)
);

-- শুধু worker (service_role) এর অভ্যন্তরীণ rate-limit স্টেট — কোনো workspace_id নেই, কোনো
-- ড্যাশবোর্ড পেজ এই টেবিল সরাসরি পড়ে না। authenticated এর জন্য কোনো SELECT policy দেওয়া
-- হচ্ছে না (RLS enable করা থাকায় এটাই effectively deny-all authenticated এর জন্য)
alter table public.messenger_comment_rule_cooldowns enable row level security;

grant select, insert, update, delete on public.messenger_comment_rule_cooldowns to service_role;

-- atomic claim — WhatsApp গ্রুপ কিওয়ার্ড রুল/আগের per-rule cooldown এর single-UPDATE প্যাটার্নের
-- সমতুল্য, কিন্তু এখানে ON CONFLICT DO UPDATE...WHERE দিয়ে (rule_id, from_psid) জোড়ার জন্য।
-- cooldown পার হলে (বা প্রথমবার এই কমেন্টকারী) true + row ইনসার্ট/আপডেট হয়, নাহলে কোনো
-- পরিবর্তন ছাড়াই false — এক স্টেটমেন্টে atomic বলে একই কমেন্টকারীর দুইটা প্রায়-একসাথে আসা
-- কমেন্ট একই রুলে ম্যাচ করলেও একটাই রিপ্লাই যাবে
create or replace function public.try_claim_comment_rule_cooldown(
  p_rule_id uuid,
  p_from_psid text,
  p_cooldown_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  insert into public.messenger_comment_rule_cooldowns (rule_id, from_psid, last_triggered_at)
  values (p_rule_id, p_from_psid, now())
  on conflict (rule_id, from_psid) do update
    set last_triggered_at = now()
    where public.messenger_comment_rule_cooldowns.last_triggered_at < now() - make_interval(secs => p_cooldown_seconds);

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- শুধু service_role (worker) কল করবে
revoke all on function public.try_claim_comment_rule_cooldown(uuid, text, integer) from public;
grant execute on function public.try_claim_comment_rule_cooldown(uuid, text, integer) to service_role;

-- নোট: কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না।
