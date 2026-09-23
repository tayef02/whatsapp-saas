-- মডিউল ৫: ক্যাম্পেইন — ফাংশন
-- এই সব ফাংশন শুধু service_role (worker/server action) কল করবে, তাই authenticated
-- কে EXECUTE গ্র্যান্ট দেওয়া হয়নি — নাহলে কেউ সরাসরি RPC কল করে business logic bypass করতে পারত।

-- ============================================================
-- 1. apply_message_status — status শুধু সামনে যাবে (pending/scheduled/sending < sent <
-- delivered < read), টার্মিনাল (failed/cancelled/unknown) থেকে আর বদলাবে না।
-- ওয়েবহুক দুবার এলে বা উল্টো ক্রমে এলেও campaign_stats এর হিসাব ভুল হবে না (idempotent)।
-- ============================================================
create function public.apply_message_status(
  p_message_id uuid,
  p_new_status text,
  p_provider_message_id text default null,
  p_failed_reason text default null
) returns boolean
language plpgsql
as $$
declare
  v_campaign_id uuid;
  v_current_status text;
  v_rank_current int;
  v_rank_new int;
begin
  select status, campaign_id into v_current_status, v_campaign_id
  from public.messages where id = p_message_id
  for update;

  if not found then
    return false;
  end if;

  v_rank_current := case v_current_status
    when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
    when 'failed' then 99 when 'cancelled' then 99 when 'unknown' then 99
    else 0
  end;
  v_rank_new := case p_new_status
    when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
    when 'failed' then 99
    else 0
  end;

  if v_rank_current >= 99 or v_rank_new <= v_rank_current then
    return false;
  end if;

  update public.messages set
    status = p_new_status,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    failed_reason = coalesce(p_failed_reason, failed_reason),
    sent_at = case when p_new_status = 'sent' then now() else sent_at end,
    delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
    read_at = case when p_new_status = 'read' then now() else read_at end
  where id = p_message_id;

  if p_new_status = 'sent' then
    update public.campaign_stats set sent_count = sent_count + 1, updated_at = now() where campaign_id = v_campaign_id;
  elsif p_new_status = 'delivered' then
    update public.campaign_stats set delivered_count = delivered_count + 1, updated_at = now() where campaign_id = v_campaign_id;
  elsif p_new_status = 'read' then
    update public.campaign_stats set read_count = read_count + 1, updated_at = now() where campaign_id = v_campaign_id;
  elsif p_new_status = 'failed' then
    update public.campaign_stats set failed_count = failed_count + 1, updated_at = now() where campaign_id = v_campaign_id;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_message_status(uuid, text, text, text) from public;
grant execute on function public.apply_message_status(uuid, text, text, text) to service_role;

-- ============================================================
-- 2. schedule_number_messages — একটা নাম্বারের pending মেসেজগুলোকে (সব ক্যাম্পেইন
-- মিলিয়ে) দৈনিক লিমিট/warmup/ডিলে মেনে scheduled_at বসিয়ে দেয়। pg_advisory_xact_lock
-- দিয়ে লক করা, যাতে একাধিক worker একই নাম্বারের হিসাব একসাথে না করে।
-- quiet hours চেক Node থেকে (Asia/Dhaka, Intl দিয়ে হিসাব করা সহজ ও নির্ভরযোগ্য) পাঠানো হয়।
-- ============================================================
create function public.schedule_number_messages(
  p_number_id uuid,
  p_is_quiet_hours boolean,
  p_batch_size integer default 20
) returns integer
language plpgsql
as $$
declare
  v_configured_limit integer;
  v_min_delay integer;
  v_max_delay integer;
  v_connected_at timestamptz;
  v_effective_limit integer;
  v_sent_today integer;
  v_scheduled_pending integer;
  v_remaining integer;
  v_last_time timestamptz;
  v_scheduled_count integer := 0;
  v_msg record;
begin
  perform pg_advisory_xact_lock(hashtext(p_number_id::text)::bigint);

  if p_is_quiet_hours then
    return 0;
  end if;

  select daily_message_limit, min_delay_seconds, max_delay_seconds, connected_at
    into v_configured_limit, v_min_delay, v_max_delay, v_connected_at
  from public.whatsapp_numbers
  where id = p_number_id and status = 'online';

  if not found then
    return 0;
  end if;

  -- warmup: নতুন কানেক্ট করা নাম্বারে ধীরে ধীরে দৈনিক লিমিট বাড়বে
  v_effective_limit := case
    when v_connected_at is null then least(v_configured_limit, 20)
    when now() - v_connected_at < interval '2 days' then least(v_configured_limit, 20)
    when now() - v_connected_at < interval '4 days' then least(v_configured_limit, 50)
    when now() - v_connected_at < interval '7 days' then least(v_configured_limit, 100)
    when now() - v_connected_at < interval '14 days' then least(v_configured_limit, 150)
    else v_configured_limit
  end;

  select count(*) into v_sent_today
  from public.messages
  where whatsapp_number_id = p_number_id
    and status in ('sent', 'delivered', 'read')
    and sent_at >= (date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka');

  select count(*) into v_scheduled_pending
  from public.messages
  where whatsapp_number_id = p_number_id and status = 'scheduled';

  v_remaining := v_effective_limit - v_sent_today - v_scheduled_pending;
  if v_remaining <= 0 then
    return 0;
  end if;

  select coalesce(max(scheduled_at), now()) into v_last_time
  from public.messages
  where whatsapp_number_id = p_number_id and status = 'scheduled';

  if v_last_time < now() then
    v_last_time := now();
  end if;

  for v_msg in
    select m.id
    from public.messages m
    join public.campaigns c on c.id = m.campaign_id
    where m.whatsapp_number_id = p_number_id
      and m.status = 'pending'
      and c.status = 'sending'
    order by c.created_at asc, m.created_at asc
    limit least(v_remaining, p_batch_size)
  loop
    v_last_time := v_last_time + (v_min_delay + floor(random() * (v_max_delay - v_min_delay + 1))) * interval '1 second';

    update public.messages
    set status = 'scheduled', scheduled_at = v_last_time
    where id = v_msg.id;

    v_scheduled_count := v_scheduled_count + 1;
  end loop;

  return v_scheduled_count;
end;
$$;

revoke all on function public.schedule_number_messages(uuid, boolean, integer) from public;
grant execute on function public.schedule_number_messages(uuid, boolean, integer) to service_role;

-- ============================================================
-- 3. mark_stuck_messages_unknown — worker ক্র্যাশ করলে মেসেজ 'sending' এ আটকে
-- থাকতে পারে। ১০ মিনিট পার হলে সেটা আসলে গেছে কিনা নিশ্চিত না, তাই আবার পাঠানো
-- হয় না — 'unknown' এ রেখে রিপোর্টে দেখানো হয়।
-- ============================================================
create function public.mark_stuck_messages_unknown()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  create temporary table _stuck_ids on commit drop as
  select id, campaign_id from public.messages
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  select count(*) into v_count from _stuck_ids;

  if v_count = 0 then
    return 0;
  end if;

  update public.messages m set status = 'unknown'
  from _stuck_ids s where m.id = s.id;

  update public.campaign_stats cs
  set unknown_count = cs.unknown_count + agg.cnt, updated_at = now()
  from (select campaign_id, count(*) as cnt from _stuck_ids group by campaign_id) agg
  where cs.campaign_id = agg.campaign_id;

  return v_count;
end;
$$;

revoke all on function public.mark_stuck_messages_unknown() from public;
grant execute on function public.mark_stuck_messages_unknown() to service_role;
