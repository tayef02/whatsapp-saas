-- মডিউল ১ ফিক্স: workspace বানানোর সময় RLS ভায়োলেশন এরর আসছিল কারণ
-- app থেকে দুইটা আলাদা insert (workspaces + workspace_members) করা হচ্ছিল।
-- এখন একটা security definer ফাংশন দিয়ে দুটো insert একসাথে, নিরাপদে হবে।

create function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated: লগইন করা নেই';
  end if;

  insert into public.workspaces (name, owner_id)
  values (workspace_name, auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

-- ডিফল্টভাবে সবাই execute করতে পারে, সেটা বন্ধ করে শুধু authenticated ইউজারকে অনুমতি
revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
