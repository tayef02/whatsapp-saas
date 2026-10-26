-- ইমেইল চ্যানেল ফেজ ২ — কন্টাক্ট, ইম্পোর্ট (সম্মতির রেকর্ডসহ), স্কিপ-লগ, টেমপ্লেট (docs/email-plan.md)
--
-- নতুন টেবিল (সবগুলোতে RLS চালু + স্পষ্ট GRANT + policy):
--   email_contact_imports — প্রতিটা ইম্পোর্টের রো; সম্মতি-নিশ্চিতকরণ (কে, কখন, কোন বাক্যে) এখানে বাধ্যতামূলক
--   email_contacts        — ইমেইল কন্টাক্ট (WhatsApp এর contacts থেকে সম্পূর্ণ আলাদা)
--   email_contact_skips   — ইম্পোর্টে যেসব ঠিকানা বাদ গেছে, প্রতিটার কারণসহ রো
--   email_templates       — সাবজেক্ট + HTML + plain text
-- নতুন ফাংশন: import_email_contacts_batch() — এক ব্যাচ ঠিকানা একসাথে (suppression মিলিয়ে) বসায়
-- নতুন storage bucket: email-imports (private, বড় ফাইল worker প্রসেস করার আগে সাময়িক)
--
-- ✔ কোনো serial/bigserial কলাম নেই (সব uuid) — আলাদা sequence GRANT লাগে না (migration 0024)।
-- ✔ email_contacts এ opted_out ফ্ল্যাগ নেই — suppression (email_suppressions) ই একমাত্র সত্য।
-- ✔ লেখার নিয়ম: চারটা টেবিলেই ব্রাউজার (authenticated) শুধু SELECT পায়; সব লেখা সার্ভার অ্যাকশন/worker
--   (service_role) দিয়ে, যেখানে সম্মতি-চেকবক্স ও অনুমতি আগে যাচাই হয় — নইলে ব্রাউজার থেকে সরাসরি
--   insert করে সম্মতি এড়িয়ে যাওয়া যেত।
--
-- ============================================================
-- ⚠ লাইভ টেবিলের ঝুঁকি
-- ============================================================
-- বিদ্যমান কোনো টেবিল বদলায় না (WhatsApp/Messenger/অন্য কিছু ছোঁয়া হয়নি) — শুধু নতুন টেবিল, একটা
-- ফাংশন, একটা storage bucket। রোলব্যাক: নিচের "ROLLBACK" মন্তব্য দেখুন। অ্যাপ কোড ডিপ্লয়ের আগে
-- এই migration চালাতে হবে। migration 0054 আগে চালানো থাকতে হবে (email_suppressions লাগে)।

-- ============================================================
-- 1. email_contact_imports
-- ============================================================
create table public.email_contact_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  added_count integer not null default 0,
  -- ফাইলের ভেতরের ডুপ্লিকেট + আগে থেকে তালিকায় থাকা
  duplicate_count integer not null default 0,
  -- ইমেইল ফরম্যাট ভুল বা ঘর ফাঁকা
  invalid_count integer not null default 0,
  -- email_suppressions এ থাকায় বাদ
  suppressed_count integer not null default 0,
  error_message text,
  applied_tag text check (applied_tag is null or length(applied_tag) <= 50),
  -- সম্মতির রেকর্ড: কে (ইমেইল-স্ন্যাপশট), কখন, কোন বাক্যে — সবগুলো NOT NULL, সম্মতি ছাড়া ইম্পোর্টের
  -- রো-ই তৈরি হতে পারে না। ইউজার অ্যাকাউন্ট পরে মুছে গেলেও প্রমাণ থাকে (id null হয়, ইমেইল-স্ন্যাপশট থাকে)
  consent_confirmed_at timestamptz not null,
  consent_confirmed_by uuid references auth.users (id) on delete set null,
  consent_confirmed_by_email text not null,
  -- ইউজারকে যে বাক্যটা দেখানো হয়েছিল তার হুবহু কপি + সংস্করণ (বাক্য বদলালেও পুরনো প্রমাণ থাকে)
  consent_text text not null,
  consent_text_version text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index email_contact_imports_workspace_idx on public.email_contact_imports (workspace_id, created_at desc);

alter table public.email_contact_imports enable row level security;

grant select on public.email_contact_imports to authenticated;
grant select, insert, update, delete on public.email_contact_imports to service_role;

create policy "email_contact_imports_select_member" on public.email_contact_imports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. email_contacts
-- ============================================================
create table public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- সবসময় lower-case, trim করা (কোডে নরমালাইজ করে বসে; CHECK দ্বিতীয় সুরক্ষা)
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  name text check (name is null or length(name) <= 200),
  tags text[] not null default '{}',
  -- email/name বাদে ফাইলের বাকি কলাম — টেমপ্লেটে {{city}} এর মতো ব্যবহার হবে
  custom_fields jsonb not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'import')),
  -- সম্মতির উৎস: ইম্পোর্টের চেকবক্স, অথবা ম্যানুয়ালি যোগ করার সময় "সম্মতি দিয়েছেন" নিশ্চিতকরণ
  consent_source text not null check (consent_source in ('import_confirmed', 'manual_attested')),
  consent_import_id uuid references public.email_contact_imports (id) on delete set null,
  consented_by uuid references auth.users (id) on delete set null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index email_contacts_workspace_created_idx on public.email_contacts (workspace_id, created_at desc);
create index email_contacts_tags_idx on public.email_contacts using gin (tags);

alter table public.email_contacts enable row level security;

grant select on public.email_contacts to authenticated;
grant select, insert, update, delete on public.email_contacts to service_role;

create policy "email_contacts_select_member" on public.email_contacts
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. email_contact_skips — ইম্পোর্টে বাদ পড়া প্রতিটা ঠিকানার কারণসহ রেকর্ড
-- ============================================================
-- কোনো অটোমেশন কিছু স্কিপ করলে রো থাকতে হবে (প্রজেক্ট নিয়ম) — ইউজার ইম্পোর্টের পেজে দেখতে পাবেন
-- কোন সারি কেন বাদ গেছে।
create table public.email_contact_skips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  import_id uuid not null references public.email_contact_imports (id) on delete cascade,
  -- ফাইলের সারি নম্বর (হেডার = ১, প্রথম ডাটা = ২)
  row_no integer not null,
  -- ফাইলে যা ছিল (ছোট করে কাটা) — নিজের workspace এর ডাটা, RLS দিয়ে সুরক্ষিত
  email text check (email is null or length(email) <= 320),
  reason text not null check (reason in (
    'empty_email', 'invalid_format', 'duplicate_in_file', 'already_in_list',
    'suppressed_unsubscribed', 'suppressed_hard_bounce', 'suppressed_repeated_soft_bounce',
    'suppressed_complaint', 'suppressed_manual'
  )),
  created_at timestamptz not null default now()
);

create index email_contact_skips_import_reason_idx on public.email_contact_skips (import_id, reason, row_no);
create index email_contact_skips_workspace_idx on public.email_contact_skips (workspace_id);

alter table public.email_contact_skips enable row level security;

grant select on public.email_contact_skips to authenticated;
grant select, insert, update, delete on public.email_contact_skips to service_role;

create policy "email_contact_skips_select_member" on public.email_contact_skips
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. email_templates
-- ============================================================
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  category text check (category is null or length(category) <= 60),
  -- সাবজেক্টে {{name}} চলে; নতুন লাইন নিষিদ্ধ (header injection) — কোডেও আবার পরিষ্কার হয়
  subject text not null check (length(subject) between 1 and 300 and subject !~ E'[\\r\\n]'),
  -- ইনবক্সে সাবজেক্টের পাশে দেখানো ছোট লেখা (ঐচ্ছিক)
  preheader text check (preheader is null or length(preheader) <= 200),
  body_html text not null check (length(body_html) <= 200000),
  -- ফাঁকা হলে পাঠানোর সময় HTML থেকে বানানো হয়
  body_text text not null default '' check (length(body_text) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_templates_workspace_idx on public.email_templates (workspace_id, created_at desc);

alter table public.email_templates enable row level security;

grant select on public.email_templates to authenticated;
grant select, insert, update, delete on public.email_templates to service_role;

create policy "email_templates_select_member" on public.email_templates
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. import_email_contacts_batch() — এক ব্যাচ (কোডে ≤৫০০) একসাথে, এক কলে
-- ============================================================
-- p_rows: [{"row_no":2,"email":"a@b.com","name":"..","custom_fields":{..}}, ...] — ইমেইল আগেই কোডে
-- lower-case ও ফরম্যাট-যাচাই করা। এই ফাংশন বাকি দুই কাজ করে:
--   • email_suppressions এ থাকা ঠিকানা → কন্টাক্ট বসে না, স্কিপ রো (suppressed_<কারণ>)
--   • আগে থেকে তালিকায় থাকা → স্কিপ রো (already_in_list)
--   • বাকিরা email_contacts এ বসে (সম্মতির তথ্যসহ)
-- সব একটাই স্টেটমেন্টে (atomic) — আংশিক অবস্থা থাকে না। ফেরত: শুধু গণনা (PostgREST এর ১০০০ রো
-- সীমায় কেটে যাওয়ার সুযোগ নেই, কারণ রো ফেরত আসে না)।
create or replace function public.import_email_contacts_batch(
  p_workspace_id uuid,
  p_import_id uuid,
  p_consented_by uuid,
  p_tag text,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer;
  v_suppressed integer;
  v_existing integer;
begin
  with input as (
    select r.row_no, r.email, nullif(btrim(r.name), '') as name, coalesce(r.custom_fields, '{}'::jsonb) as custom_fields
    from jsonb_to_recordset(p_rows) as r(row_no integer, email text, name text, custom_fields jsonb)
    where r.email is not null
  ),
  blocked as (
    select i.row_no, i.email, s.reason
    from input i
    join public.email_suppressions s on s.workspace_id = p_workspace_id and s.email_lower = i.email
  ),
  skipped_blocked as (
    insert into public.email_contact_skips (workspace_id, import_id, row_no, email, reason)
    select p_workspace_id, p_import_id, b.row_no, b.email, 'suppressed_' || b.reason
    from blocked b
    returning 1
  ),
  inserted as (
    insert into public.email_contacts
      (workspace_id, email, name, tags, custom_fields, source, consent_source, consent_import_id, consented_by)
    select
      p_workspace_id, i.email, i.name,
      case when p_tag is null or p_tag = '' then '{}'::text[] else array[p_tag] end,
      i.custom_fields, 'import', 'import_confirmed', p_import_id, p_consented_by
    from input i
    where not exists (select 1 from blocked b where b.email = i.email)
    on conflict (workspace_id, email) do nothing
    returning email
  ),
  skipped_existing as (
    insert into public.email_contact_skips (workspace_id, import_id, row_no, email, reason)
    select p_workspace_id, p_import_id, i.row_no, i.email, 'already_in_list'
    from input i
    where not exists (select 1 from blocked b where b.email = i.email)
      and not exists (select 1 from inserted n where n.email = i.email)
    returning 1
  )
  select
    (select count(*) from inserted),
    (select count(*) from skipped_blocked),
    (select count(*) from skipped_existing)
  into v_added, v_suppressed, v_existing;

  return jsonb_build_object('added', v_added, 'suppressed', v_suppressed, 'already_in_list', v_existing);
end;
$$;

revoke all on function public.import_email_contacts_batch(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_email_contacts_batch(uuid, uuid, uuid, text, jsonb) to service_role;

-- ============================================================
-- 6. Storage bucket — বড় ইম্পোর্ট ফাইল worker প্রসেস করার আগে সাময়িক রাখার জন্য (প্রসেসের পর মুছে যায়)।
-- শুধু service_role (server action + worker) ব্যবহার করে, তাই authenticated এর জন্য storage policy নেই।
-- ============================================================
insert into storage.buckets (id, name, public)
values ('email-imports', 'email-imports', false)
on conflict (id) do nothing;

-- ROLLBACK (শুধু ইমেইল ফেজ ২ এর কিছু ব্যবহার না হলে):
--   drop function public.import_email_contacts_batch(uuid, uuid, uuid, text, jsonb);
--   drop table public.email_templates, public.email_contact_skips, public.email_contacts, public.email_contact_imports cascade;
--   delete from storage.buckets where id = 'email-imports';
