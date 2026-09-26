-- 0015 এ contacts.source কলামে 'inbound' যোগ করার চেষ্টা হয়েছিল, কিন্তু constraint এর
-- নাম ভুল অনুমান করা হয়েছিল (contacts_source_check), তাই আসল constraint (যেটা এখনো শুধু
-- 'manual'/'import' এলাউ করে) ড্রপ হয়নি — নতুন করে যোগ করা constraint টা পাশাপাশি বসে
-- ছিল, কিন্তু পুরনোটাই insert আটকে দিচ্ছিল। এখন আসল নাম pg_constraint থেকে খুঁজে বের
-- করে ড্রপ করা হচ্ছে (নাম যাই হোক না কেন)।
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.contacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.contacts drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.contacts add constraint contacts_source_check check (source in ('manual', 'import', 'inbound'));
