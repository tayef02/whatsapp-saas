-- Phase ১ (চ্যানেল বিচ্ছিন্নতা) — Messenger এর নিজস্ব AI চ্যাটবট সেটিংস + নলেজ বেস।
-- WhatsApp এর workspace_ai_settings/knowledge_base_documents/knowledge_base_chunks
-- (migration 0017/0020/0021) এর টেবিল/RPC কাঠামো হুবহু কপি করা হয়েছে, শুধু নাম "messenger_"
-- প্রিফিক্স দিয়ে — বিদ্যমান WhatsApp টেবিলের schema/PK কিছুই বদলানো হয়নি (কম ঝুঁকির পথ,
-- লাইভ WhatsApp AI ডেটা স্পর্শ করে না)। storage bucket নতুন লাগেনি — বিদ্যমান প্রাইভেট
-- "knowledge-base-docs" বাকেট reuse হবে, পাথ `{workspace_id}/messenger/{file}` (workspace_id
-- প্রথম ফোল্ডার থাকায় migration 0017 এর storage RLS policy এর শর্ত — (storage.foldername
-- (name))[1]::uuid — অক্ষতই থাকে, যদিও বাস্তবে সব স্টোরেজ অ্যাক্সেস service_role দিয়ে হয়
-- বলে RLS কার্যত প্রযোজ্যই হয় না)।
--
-- ⚠️ কোনো বিদ্যমান টেবিল alter হয়নি, শুধু নতুন টেবিল/ফাংশন — তাই ঝুঁকি কম, তবু নতুন
-- extension/vault ফাংশন তৈরি করে বলে কম-ট্রাফিকের সময় চালানোর পরামর্শ।

-- ============================================================
-- 1. messenger_ai_settings — প্রতি workspace একটা row (WhatsApp এর থেকে সম্পূর্ণ আলাদা রো,
--    একই workspace এর দুই চ্যানেলের AI সেটিংস আলাদা থাকতে পারবে)
-- ============================================================
create table public.messenger_ai_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  llm_provider text check (llm_provider in ('openai', 'gemini')),
  -- আসল API key কখনো plaintext কোনো টেবিলে থাকে না — Supabase Vault এ এনক্রিপ্টেড থাকে,
  -- এখানে শুধু vault.secrets এর id। set/read শুধু নিচের ফাংশন দুটো দিয়ে হয়
  api_key_secret_id uuid,
  system_prompt text,
  confidence_threshold numeric not null default 0.75,
  support_phone text,
  typical_delivery_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger messenger_ai_settings_set_updated_at
  before update on public.messenger_ai_settings
  for each row execute function public.set_updated_at();

alter table public.messenger_ai_settings enable row level security;

-- api_key_secret_id ইচ্ছাকৃতভাবে এই GRANT এ নেই — ইউজার সরাসরি সেট/বদলাতে পারবে না,
-- শুধু set_messenger_ai_api_key() ফাংশন দিয়ে (নিচে) করতে হবে
grant select on public.messenger_ai_settings to authenticated;
grant insert (workspace_id, llm_provider, system_prompt, confidence_threshold, support_phone, typical_delivery_time) on public.messenger_ai_settings to authenticated;
grant update (llm_provider, system_prompt, confidence_threshold, support_phone, typical_delivery_time) on public.messenger_ai_settings to authenticated;
grant select, insert, update, delete on public.messenger_ai_settings to service_role;

create policy "messenger_ai_settings_select_member" on public.messenger_ai_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "messenger_ai_settings_insert_member" on public.messenger_ai_settings
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "messenger_ai_settings_update_member" on public.messenger_ai_settings
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. API key সেট করা — workspace_ai_settings এর set_workspace_api_key এর হুবহু একই প্যাটার্ন
-- ============================================================
create function public.set_messenger_ai_api_key(p_workspace_id uuid, p_api_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_secret_id uuid;
  v_new_secret_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'অনুমতি নেই';
  end if;

  select api_key_secret_id into v_existing_secret_id
  from public.messenger_ai_settings where workspace_id = p_workspace_id;

  if v_existing_secret_id is not null then
    perform vault.update_secret(v_existing_secret_id, p_api_key);
    v_new_secret_id := v_existing_secret_id;
  else
    v_new_secret_id := vault.create_secret(p_api_key, 'messenger_' || p_workspace_id::text || '_llm_key');
  end if;

  insert into public.messenger_ai_settings (workspace_id, api_key_secret_id)
  values (p_workspace_id, v_new_secret_id)
  on conflict (workspace_id) do update set api_key_secret_id = v_new_secret_id, updated_at = now();
end;
$$;

revoke all on function public.set_messenger_ai_api_key(uuid, text) from public;
grant execute on function public.set_messenger_ai_api_key(uuid, text) to authenticated;

-- ডিক্রিপ্টেড key শুধু service_role (worker) পড়তে পারবে
create function public.get_messenger_ai_api_key(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets ds
  join public.messenger_ai_settings s on s.api_key_secret_id = ds.id
  where s.workspace_id = p_workspace_id;

  return v_key;
end;
$$;

revoke all on function public.get_messenger_ai_api_key(uuid) from public;
grant execute on function public.get_messenger_ai_api_key(uuid) to service_role;

-- ============================================================
-- 3. messenger_knowledge_base_documents
-- ============================================================
create table public.messenger_knowledge_base_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null check (file_type in ('pdf', 'xlsx', 'csv', 'txt')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  full_text text,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index messenger_kb_documents_workspace_idx on public.messenger_knowledge_base_documents (workspace_id, created_at desc);

alter table public.messenger_knowledge_base_documents enable row level security;

grant select, insert, update, delete on public.messenger_knowledge_base_documents to authenticated, service_role;

create policy "messenger_kb_documents_all_member" on public.messenger_knowledge_base_documents
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. messenger_knowledge_base_chunks
-- ============================================================
create table public.messenger_knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.messenger_knowledge_base_documents (id) on delete cascade,
  content text not null,
  embedding_openai extensions.vector(1536),
  embedding_gemini extensions.vector(768),
  created_at timestamptz not null default now()
);

create index messenger_kb_chunks_document_idx on public.messenger_knowledge_base_chunks (document_id);
create index messenger_kb_chunks_workspace_idx on public.messenger_knowledge_base_chunks (workspace_id);

alter table public.messenger_knowledge_base_chunks enable row level security;

grant select on public.messenger_knowledge_base_chunks to authenticated;
grant select, insert, update, delete on public.messenger_knowledge_base_chunks to service_role;

create policy "messenger_kb_chunks_select_member" on public.messenger_knowledge_base_chunks
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. search_knowledge_base এর ঠিক একই লজিক, শুধু messenger_knowledge_base_chunks এর উপর
-- ============================================================
create function public.search_messenger_knowledge_base(
  p_workspace_id uuid,
  p_query_embedding extensions.vector,
  p_provider text,
  p_match_count integer default 4
)
returns table (id uuid, content text, similarity real)
language plpgsql
as $$
begin
  if p_provider = 'openai' then
    return query
      select c.id, c.content, (1 - (c.embedding_openai <=> p_query_embedding))::real as similarity
      from public.messenger_knowledge_base_chunks c
      where c.workspace_id = p_workspace_id and c.embedding_openai is not null
      order by c.embedding_openai <=> p_query_embedding
      limit p_match_count;
  else
    return query
      select c.id, c.content, (1 - (c.embedding_gemini <=> p_query_embedding))::real as similarity
      from public.messenger_knowledge_base_chunks c
      where c.workspace_id = p_workspace_id and c.embedding_gemini is not null
      order by c.embedding_gemini <=> p_query_embedding
      limit p_match_count;
  end if;
end;
$$;

revoke all on function public.search_messenger_knowledge_base(uuid, extensions.vector, text, integer) from public;
grant execute on function public.search_messenger_knowledge_base(uuid, extensions.vector, text, integer) to service_role;

-- নোট: id/workspace_id/document_id সব uuid, কোনো bigserial/serial কলাম নেই — আলাদা
-- sequence GRANT লাগে না।
