-- মডিউল ৪: টেমপ্লেট (variables + spintax + media)

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  content text not null default '',
  -- ফেজ ২-এর রেডি বাংলা টেমপ্লেট লাইব্রেরির জন্য (ঈদ, সেল, রিমাইন্ডার...) — এখন ফ্রি-টেক্সট
  category text,
  -- ঐচ্ছিক ছবি/PDF, ক্যাম্পেইনে ডিফল্ট attachment হিসেবে ব্যবহার হবে
  media_url text,
  media_type text check (media_type in ('image', 'document')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_workspace_idx on public.templates (workspace_id, created_at desc);

-- এডিট করলে updated_at অটো বসবে
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

grant select, insert, update, delete on public.templates to authenticated, service_role;

create policy "templates_select_member" on public.templates
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "templates_insert_member" on public.templates
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "templates_update_member" on public.templates
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "templates_delete_member" on public.templates
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- media public রাখা হয়েছে কারণ WhatsApp (Evolution API) কে এই URL থেকে সরাসরি
-- ফাইল fetch করতে হবে — upload/delete শুধু service_role (server action) করে,
-- তাই authenticated এর জন্য আলাদা storage policy লাগছে না
insert into storage.buckets (id, name, public)
values ('template-media', 'template-media', true)
on conflict (id) do nothing;
