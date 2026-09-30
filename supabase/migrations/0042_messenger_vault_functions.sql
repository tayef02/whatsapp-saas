-- Messenger পেজ অ্যাক্সেস টোকেন Vault এ সেভ/পড়া/মোছার ফাংশন — workspace_ai_settings এর
-- set_workspace_api_key/get_workspace_api_key (migration 0017) এর ঠিক একই প্যাটার্ন, শুধু
-- workspace_id এর বদলে messenger_pages.id (p_page_id) দিয়ে কী করা হয়, আর workspace-membership
-- messenger_pages.workspace_id join করে যাচাই হয়।

create function public.set_messenger_page_token(p_page_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_existing_secret_id uuid;
  v_new_secret_id uuid;
begin
  select workspace_id, page_access_token_secret_id into v_workspace_id, v_existing_secret_id
  from public.messenger_pages where id = p_page_id;

  if v_workspace_id is null then
    raise exception 'পেজ পাওয়া যায়নি';
  end if;
  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'অনুমতি নেই';
  end if;

  if v_existing_secret_id is not null then
    perform vault.update_secret(v_existing_secret_id, p_token);
    v_new_secret_id := v_existing_secret_id;
  else
    v_new_secret_id := vault.create_secret(p_token, 'messenger_page_' || p_page_id::text || '_token');
  end if;

  update public.messenger_pages set page_access_token_secret_id = v_new_secret_id where id = p_page_id;
end;
$$;

revoke all on function public.set_messenger_page_token(uuid, text) from public;
grant execute on function public.set_messenger_page_token(uuid, text) to authenticated;

-- ডিক্রিপ্টেড টোকেন শুধু service_role (worker) পড়তে পারবে — web/authenticated কখনো না
create function public.get_messenger_page_token(p_page_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets ds
  join public.messenger_pages p on p.page_access_token_secret_id = ds.id
  where p.id = p_page_id;

  return v_token;
end;
$$;

revoke all on function public.get_messenger_page_token(uuid) from public;
grant execute on function public.get_messenger_page_token(uuid) to service_role;

-- ডিসকানেক্ট বাটনে — Vault থেকে secret পুরোপুরি মুছে, কলাম null করে status বদলায়
create function public.clear_messenger_page_token(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_secret_id uuid;
begin
  select workspace_id, page_access_token_secret_id into v_workspace_id, v_secret_id
  from public.messenger_pages where id = p_page_id;

  if v_workspace_id is null then
    raise exception 'পেজ পাওয়া যায়নি';
  end if;
  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'অনুমতি নেই';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  update public.messenger_pages
  set page_access_token_secret_id = null, status = 'disconnected'
  where id = p_page_id;
end;
$$;

revoke all on function public.clear_messenger_page_token(uuid) from public;
grant execute on function public.clear_messenger_page_token(uuid) to authenticated;
