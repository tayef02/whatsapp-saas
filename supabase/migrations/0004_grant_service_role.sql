-- ফিক্স: "Automatic expose new tables" বন্ধ থাকায় service_role ও অটো-গ্র্যান্ট পায় না।
-- service_role RLS বাইপাস করে ঠিকই, কিন্তু বেসিক টেবিল GRANT আলাদা জিনিস —
-- সেটা ছাড়া PostgREST দিয়ে service_role ক্লায়েন্ট থেকে insert/select করলে
-- "permission denied for table ..." এরর আসে। worker আর server action এর
-- admin client (createAdminClient) যে টেবিলগুলো সরাসরি ছোঁয়, সেগুলোতে
-- service_role কে explicit GRANT দেওয়া হলো।

grant select, insert, update, delete on public.evolution_servers to service_role;
grant select, insert, update, delete on public.whatsapp_numbers to service_role;
