-- ফিক্স: template-media bucket পাবলিক রাখা ঠিক হয়নি — কেউ URL অনুমান করতে পারলে
-- অন্য workspace এর মার্কেটিং ছবি/PDF দেখে ফেলতে পারত। এখন private, আর মেসেজ
-- পাঠানোর সময় worker অল্প সময়ের (~১ ঘণ্টা) signed URL বানিয়ে Evolution কে দেবে।
-- templates.media_url কলামে এখন থেকে পুরো URL না, শুধু storage path সেভ হবে।

update storage.buckets set public = false where id = 'template-media';

-- প্রতি workspace শুধু নিজের ফোল্ডার (path এর প্রথম অংশ = workspace_id) দেখতে/লিখতে পারবে।
-- অ্যাপ সবসময় service_role (server action/worker) দিয়ে storage ছোঁয়, যেটা RLS বাইপাস করে,
-- তাই এই পলিসি মূলত defense-in-depth — ভবিষ্যতে ক্লায়েন্ট থেকে সরাসরি অ্যাক্সেস লাগলেও নিরাপদ থাকবে।
create policy "template_media_select_own_workspace" on storage.objects
  for select to authenticated
  using (bucket_id = 'template-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "template_media_insert_own_workspace" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'template-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "template_media_delete_own_workspace" on storage.objects
  for delete to authenticated
  using (bucket_id = 'template-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
