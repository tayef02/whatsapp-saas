-- বিটা/ডেমো ভিডিওর আগে টেস্ট ডেটা পরিষ্কার করার dry-run।
-- শুধু SELECT — কিছুই মোছে না। 02_delete.sql চালানোর আগে এই কাউন্টগুলো দেখে নিশ্চিত হয়ে নিন।
--
-- এখানে কোনো workspace_id ফিল্টার নেই — পুরো প্রজেক্টের সব workspace জুড়ে টেস্ট ডেটা মোছার
-- হিসাব দেখাচ্ছে (বিটার আগে পুরো অ্যাপ পরিষ্কার করার জন্য)।

select 'contacts' as item, count(*) as row_count from public.contacts
union all
select 'conversation_messages', count(*) from public.conversation_messages
union all
select 'conversations', count(*) from public.conversations
union all
select 'messages (ক্যাম্পেইন মেসেজ/ডেলিভারি রিপোর্ট, সব মাসের partition মিলিয়ে)', count(*) from public.messages
union all
select 'campaign_stats', count(*) from public.campaign_stats
union all
select 'campaigns', count(*) from public.campaigns
union all
select 'order_status_history', count(*) from public.order_status_history
union all
select 'orders', count(*) from public.orders
union all
select 'group_messages', count(*) from public.group_messages
union all
select 'group_scheduled_announcement_targets', count(*) from public.group_scheduled_announcement_targets
union all
select 'group_scheduled_announcements', count(*) from public.group_scheduled_announcements
union all
select 'notifications', count(*) from public.notifications
union all
select 'contact_imports', count(*) from public.contact_imports
union all
-- whatsapp_numbers তিন ভাগে ভাগ করে দেখানো হচ্ছে, যাতে কোনটা মুছবে/কোনটা স্কিপ হবে/কোনটা
-- একদমই ছোঁয়া হবে না তা স্পষ্ট বোঝা যায় (groups.whatsapp_number_id এ ON DELETE CASCADE
-- থাকায় গ্রুপ-যুক্ত নাম্বার মুছলে সেই গ্রুপও চলে যেত, তাই সেগুলো ইচ্ছাকৃতভাবে বাদ)
select 'whatsapp_numbers — মুছে ফেলা হবে (offline/connecting, কোনো গ্রুপ যুক্ত নেই)', count(*)
  from public.whatsapp_numbers wn
  where wn.status in ('offline', 'connecting')
    and not exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id)
union all
select 'whatsapp_numbers — স্কিপ হবে (offline/connecting কিন্তু গ্রুপ যুক্ত আছে, ম্যানুয়ালি রিভিউ করুন)', count(*)
  from public.whatsapp_numbers wn
  where wn.status in ('offline', 'connecting')
    and exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id)
union all
select 'whatsapp_numbers — রাখা হবে (online, কোনোভাবেই ছোঁয়া হবে না)', count(*)
  from public.whatsapp_numbers
  where status = 'online'
union all
select 'whatsapp_numbers — রাখা হবে (banned, তথ্যের জন্য দেখানো হচ্ছে, cleanup এ ধরা হয়নি)', count(*)
  from public.whatsapp_numbers
  where status = 'banned';

-- নিচে "স্কিপ হবে" ক্যাটাগরির নাম্বারগুলোর বিস্তারিত তালিকা — কোন গ্রুপ যুক্ত আছে দেখে
-- সিদ্ধান্ত নিন এগুলো নিয়ে কী করবেন (02_delete.sql এই নাম্বারগুলো ছোঁবে না)
select
  wn.id,
  wn.display_name,
  wn.phone_number,
  wn.status,
  wn.created_at,
  (select string_agg(g.name, ', ') from public.groups g where g.whatsapp_number_id = wn.id) as attached_groups
from public.whatsapp_numbers wn
where wn.status in ('offline', 'connecting')
  and exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id)
order by wn.created_at desc;
