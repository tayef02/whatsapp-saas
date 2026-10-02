-- migration 0048 এ cooldown প্রতি-কমেন্টকারী করা হয়েছিল, কিন্তু তখনো "cooldown active হলে
-- রিপ্লাই স্কিপ" আচরণ ছিল — একই কাস্টমার অল্প সময়ে বারবার কমেন্ট করলে প্রথমটা ছাড়া বাকিগুলো
-- কখনোই রিপ্লাই পেত না। ইউজার চেয়েছেন: কোনো কমেন্টই স্কিপ না হোক, শুধু cooldown এর মধ্যে
-- পড়লে রিপ্লাই পরে (cooldown_seconds ব্যবধানে, পালাক্রমে) পাঠানো হোক — একটা "ড্রিপ queue"।
--
-- তাই cooldown টেবিলের কলাম last_triggered_at ("সর্বশেষ কখন ট্রিগার হয়েছে") থেকে
-- next_available_at ("পরের রিপ্লাইটা কখন পাঠানো যাবে") এ বদলানো হলো — আর নতুন একটা RPC যেটা
-- "স্কিপ করবে কিনা" বলে না, বরং এই কমেন্টের রিপ্লাই ঠিক কখন পাঠানো উচিত সেটা রিজার্ভ করে
-- রিটার্ন করে (BullMQ job এর delay হিসেবে ব্যবহার হবে, worker কোডে)।

alter table public.messenger_comment_rule_cooldowns
  rename column last_triggered_at to next_available_at;

drop function if exists public.try_claim_comment_rule_cooldown(uuid, text, integer);

-- প্রতিটা কলে এই (rule, commenter) জোড়ার পরবর্তী উপলব্ধ স্লট রিজার্ভ করে রিটার্ন করে —
-- কখনো "skip" বলে না, সবসময় একটা scheduled_at টাইমস্ট্যাম্প দেয় (অতীত/বর্তমান মানে এখনই
-- পাঠানো যাবে, ভবিষ্যৎ মানে ততক্ষণ অপেক্ষা করতে হবে)। single UPSERT স্টেটমেন্ট বলে atomic —
-- একই কমেন্টকারীর দুইটা প্রায়-একসাথে আসা কমেন্ট সঠিক ক্রমে আলাদা স্লট পাবে, একটাও হারাবে না।
create or replace function public.reserve_comment_reply_slot(
  p_rule_id uuid,
  p_from_psid text,
  p_cooldown_seconds integer
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_available timestamptz;
begin
  insert into public.messenger_comment_rule_cooldowns (rule_id, from_psid, next_available_at)
  values (p_rule_id, p_from_psid, now() + make_interval(secs => p_cooldown_seconds))
  on conflict (rule_id, from_psid) do update
    set next_available_at = greatest(public.messenger_comment_rule_cooldowns.next_available_at, now())
      + make_interval(secs => p_cooldown_seconds)
  returning next_available_at into v_next_available;

  -- এই কমেন্টের জন্য reserve করা স্লট = নতুন next_available_at থেকে এক cooldown পিছনে
  -- (প্রথমবার হলে এটা ≈ now(), আগে থেকে queue থাকলে আগের শেষ স্লটের পরের cooldown ব্যবধান)
  return v_next_available - make_interval(secs => p_cooldown_seconds);
end;
$$;

revoke all on function public.reserve_comment_reply_slot(uuid, text, integer) from public;
grant execute on function public.reserve_comment_reply_slot(uuid, text, integer) to service_role;

-- নোট: কোনো bigserial/serial কলাম নেই, আলাদা sequence GRANT লাগে না।
