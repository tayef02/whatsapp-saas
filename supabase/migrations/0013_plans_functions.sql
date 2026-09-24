-- মডিউল ৭: প্ল্যান ও পেমেন্ট — ফাংশন আপডেট

-- ============================================================
-- 1. create_workspace() — নতুন workspace অটো ট্রায়াল প্ল্যানে বসবে
-- ============================================================
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  v_trial_plan_id uuid;
  v_trial_duration integer;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated: লগইন করা নেই';
  end if;

  select id, duration_days into v_trial_plan_id, v_trial_duration
  from public.plans
  where is_trial = true and is_active = true
  order by created_at asc
  limit 1;

  insert into public.workspaces (
    name, owner_id, plan_id, subscription_status, subscription_started_at, subscription_expires_at
  )
  values (
    workspace_name,
    auth.uid(),
    v_trial_plan_id,
    'trial',
    now(),
    case when v_trial_duration is not null then now() + (v_trial_duration || ' days')::interval else null end
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

-- ============================================================
-- 2. apply_message_status() — 'sent' হলে workspace এর মাসিক ব্যবহার কাউন্টার বাড়বে
-- ============================================================
create or replace function public.apply_message_status(
  p_message_id uuid,
  p_new_status text,
  p_provider_message_id text default null,
  p_failed_reason text default null
) returns boolean
language plpgsql
as $$
declare
  v_campaign_id uuid;
  v_workspace_id uuid;
  v_current_status text;
  v_rank_current int;
  v_rank_new int;
begin
  select status, campaign_id, workspace_id into v_current_status, v_campaign_id, v_workspace_id
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
    update public.workspaces set messages_used_this_cycle = messages_used_this_cycle + 1 where id = v_workspace_id;
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

-- ============================================================
-- 3. schedule_number_messages() — এখন workspace-লেভেল দৈনিক লিমিট (CLAUDE.md এর
-- "এক ইউজার পুরো সিস্টেম দখল না করে" নিয়ম) আর প্ল্যানের মাসিক কোটা/মেয়াদ চেক করে।
-- workspace-লেভেল advisory lock ও যোগ হলো, যাতে একই workspace এর একাধিক নাম্বার
-- একসাথে schedule হলেও দৈনিক ক্যাপ ঠিক থাকে (race condition এড়াতে)।
-- ============================================================
create or replace function public.schedule_number_messages(
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
  v_workspace_id uuid;
  v_effective_limit integer;
  v_sent_today integer;
  v_scheduled_pending integer;
  v_remaining integer;
  v_last_time timestamptz;
  v_scheduled_count integer := 0;
  v_msg record;
  -- workspace/প্ল্যান সংক্রান্ত
  v_subscription_status text;
  v_subscription_expires_at timestamptz;
  v_workspace_daily_limit integer;
  v_workspace_sent_today integer;
  v_monthly_limit integer;
  v_messages_used_this_cycle integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_number_id::text)::bigint);

  if p_is_quiet_hours then
    return 0;
  end if;

  select daily_message_limit, min_delay_seconds, max_delay_seconds, connected_at, workspace_id
    into v_configured_limit, v_min_delay, v_max_delay, v_connected_at, v_workspace_id
  from public.whatsapp_numbers
  where id = p_number_id and status = 'online';

  if not found then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('workspace:' || v_workspace_id::text)::bigint);

  -- মেয়াদ শেষ হয়ে গেলে (বা প্ল্যান না থাকলে) নতুন কিছু পাঠানো হবে না — ডাটা মুছবে না,
  -- শুধু sending বন্ধ থাকবে
  select w.subscription_status, w.subscription_expires_at, w.daily_message_limit,
         w.messages_used_this_cycle, p.monthly_message_limit
    into v_subscription_status, v_subscription_expires_at, v_workspace_daily_limit,
         v_messages_used_this_cycle, v_monthly_limit
  from public.workspaces w
  left join public.plans p on p.id = w.plan_id
  where w.id = v_workspace_id;

  if v_subscription_status = 'expired' or v_subscription_expires_at is null or v_subscription_expires_at < now() then
    return 0;
  end if;
  if v_monthly_limit is null then
    return 0; -- কোনো প্ল্যান নেই মানে কোনো কোটাও নেই, নিরাপদ ডিফল্ট হলো পাঠানো বন্ধ
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

  -- workspace-ভিত্তিক দৈনিক ক্যাপ (সব নাম্বার মিলিয়ে) — এক ইউজার পুরো সিস্টেম দখল না করে
  select count(*) into v_workspace_sent_today
  from public.messages
  where workspace_id = v_workspace_id
    and status in ('sent', 'delivered', 'read')
    and sent_at >= (date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka');

  v_remaining := least(v_remaining, v_workspace_daily_limit - v_workspace_sent_today);

  -- প্ল্যানের মাসিক কোটা
  v_remaining := least(v_remaining, v_monthly_limit - v_messages_used_this_cycle);

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
