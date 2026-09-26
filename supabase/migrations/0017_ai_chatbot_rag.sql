-- মডিউল ৮.৫: workspace-ভিত্তিক AI চ্যাটবট (RAG) — system prompt, knowledge base
-- (PDF/XLSX/CSV/TXT), embedding সার্চ, LLM (OpenAI/Gemini) জেনারেশন।
-- আগের keyword-rule সিস্টেম (chatbot_configs/chatbot_rules) বাদ যাচ্ছে না — দ্রুত/বিনামূল্যে
-- exact-match কেসের জন্য আগে চেক হবে, না মিললে এই RAG স্তর চেষ্টা হবে, তাতেও confidence কম
-- হলে fallback+handoff (আগের মতোই)।

create extension if not exists vector with schema extensions;
create extension if not exists supabase_vault;

-- ============================================================
-- 1. workspace_ai_settings — প্রতি workspace একটা row
-- ============================================================
create table public.workspace_ai_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  llm_provider text check (llm_provider in ('openai', 'gemini')),
  -- আসল API key কখনো plaintext কোনো টেবিলে থাকে না — Supabase Vault এ এনক্রিপ্টেড থাকে,
  -- এখানে শুধু vault.secrets এর id। set/read শুধু নিচের ফাংশন দুটো দিয়ে হয়।
  api_key_secret_id uuid,
  system_prompt text,
  confidence_threshold numeric not null default 0.75,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspace_ai_settings_set_updated_at
  before update on public.workspace_ai_settings
  for each row execute function public.set_updated_at();

alter table public.workspace_ai_settings enable row level security;

-- api_key_secret_id ইচ্ছাকৃতভাবে এই GRANT এ নেই — ইউজার সরাসরি সেট/বদলাতে পারবে না,
-- শুধু set_workspace_api_key() ফাংশন দিয়ে (নিচে) করতে হবে
grant select on public.workspace_ai_settings to authenticated;
grant insert (workspace_id, llm_provider, system_prompt, confidence_threshold) on public.workspace_ai_settings to authenticated;
grant update (llm_provider, system_prompt, confidence_threshold) on public.workspace_ai_settings to authenticated;
grant select, insert, update, delete on public.workspace_ai_settings to service_role;

create policy "workspace_ai_settings_select_member" on public.workspace_ai_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "workspace_ai_settings_insert_member" on public.workspace_ai_settings
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "workspace_ai_settings_update_member" on public.workspace_ai_settings
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. API key সেট করা — Vault এ এনক্রিপ্ট করে রাখে, plaintext টেবিলে যায় না
-- ============================================================
create function public.set_workspace_api_key(p_workspace_id uuid, p_api_key text)
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
  from public.workspace_ai_settings where workspace_id = p_workspace_id;

  if v_existing_secret_id is not null then
    perform vault.update_secret(v_existing_secret_id, p_api_key);
    v_new_secret_id := v_existing_secret_id;
  else
    v_new_secret_id := vault.create_secret(p_api_key, 'workspace_' || p_workspace_id::text || '_llm_key');
  end if;

  insert into public.workspace_ai_settings (workspace_id, api_key_secret_id)
  values (p_workspace_id, v_new_secret_id)
  on conflict (workspace_id) do update set api_key_secret_id = v_new_secret_id, updated_at = now();
end;
$$;

revoke all on function public.set_workspace_api_key(uuid, text) from public;
grant execute on function public.set_workspace_api_key(uuid, text) to authenticated;

-- ডিক্রিপ্টেড key শুধু service_role (worker) পড়তে পারবে — web/authenticated কখনো না,
-- key একবার সেট করলে আর ফেরত দেখা যাবে না, শুধু বদলানো যাবে
create function public.get_workspace_api_key(p_workspace_id uuid)
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
  join public.workspace_ai_settings s on s.api_key_secret_id = ds.id
  where s.workspace_id = p_workspace_id;

  return v_key;
end;
$$;

revoke all on function public.get_workspace_api_key(uuid) from public;
grant execute on function public.get_workspace_api_key(uuid) to service_role;

-- ============================================================
-- 3. knowledge_base_documents — আপলোড করা ফাইল
-- ============================================================
create table public.knowledge_base_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null check (file_type in ('pdf', 'xlsx', 'csv', 'txt')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index knowledge_base_documents_workspace_idx on public.knowledge_base_documents (workspace_id, created_at desc);

alter table public.knowledge_base_documents enable row level security;

grant select, insert, update, delete on public.knowledge_base_documents to authenticated, service_role;

create policy "kb_documents_all_member" on public.knowledge_base_documents
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. knowledge_base_chunks — ভাঙা টেক্সট + embedding
-- OpenAI (1536 dim) আর Gemini (768 dim) এর embedding ডাইমেনশন আলাদা, তাই দুইটা আলাদা
-- কলাম — workspace যে provider বেছে নেবে শুধু সেটাই ভরবে। provider বদলালে ডকুমেন্ট
-- আবার প্রসেস করা লাগবে (Settings পেজে "আবার প্রসেস করুন" বাটন থাকবে)।
-- ============================================================
create table public.knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.knowledge_base_documents (id) on delete cascade,
  content text not null,
  embedding_openai extensions.vector(1536),
  embedding_gemini extensions.vector(768),
  created_at timestamptz not null default now()
);

create index knowledge_base_chunks_document_idx on public.knowledge_base_chunks (document_id);
create index knowledge_base_chunks_workspace_idx on public.knowledge_base_chunks (workspace_id);

alter table public.knowledge_base_chunks enable row level security;

grant select on public.knowledge_base_chunks to authenticated;
grant select, insert, update, delete on public.knowledge_base_chunks to service_role;

create policy "kb_chunks_select_member" on public.knowledge_base_chunks
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. knowledge base থেকে সবচেয়ে কাছাকাছি অর্থের chunk খোঁজা (cosine similarity)
-- ছোট স্কেলে (প্রতি workspace কয়েকশ/হাজার chunk) brute-force ঠিক আছে, ANN index লাগবে না
-- ============================================================
create function public.search_knowledge_base(
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
      from public.knowledge_base_chunks c
      where c.workspace_id = p_workspace_id and c.embedding_openai is not null
      order by c.embedding_openai <=> p_query_embedding
      limit p_match_count;
  else
    return query
      select c.id, c.content, (1 - (c.embedding_gemini <=> p_query_embedding))::real as similarity
      from public.knowledge_base_chunks c
      where c.workspace_id = p_workspace_id and c.embedding_gemini is not null
      order by c.embedding_gemini <=> p_query_embedding
      limit p_match_count;
  end if;
end;
$$;

revoke all on function public.search_knowledge_base(uuid, extensions.vector, text, integer) from public;
grant execute on function public.search_knowledge_base(uuid, extensions.vector, text, integer) to service_role;

-- ============================================================
-- 6. Storage bucket — private, প্রতি workspace নিজের ফোল্ডার
-- ============================================================
insert into storage.buckets (id, name, public)
values ('knowledge-base-docs', 'knowledge-base-docs', false)
on conflict (id) do nothing;

create policy "kb_docs_select_own_workspace" on storage.objects
  for select to authenticated
  using (bucket_id = 'knowledge-base-docs' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "kb_docs_insert_own_workspace" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'knowledge-base-docs' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "kb_docs_delete_own_workspace" on storage.objects
  for delete to authenticated
  using (bucket_id = 'knowledge-base-docs' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
