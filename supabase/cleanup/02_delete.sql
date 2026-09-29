-- বিটা/ডেমো ভিডিওর আগে টেস্ট ডেটা মোছার স্ক্রিপ্ট।
--
-- ব্যবহারবিধি (দুই ধাপে):
-- ১. এই পুরো ফাইলটা যেমন আছে তেমন (শেষে `rollback;` সহ) একবার রান করুন। এতে কিছুই স্থায়ীভাবে
--    মোছে না — Supabase SQL Editor প্রতিটা DELETE এর "rows affected" দেখাবে, সেগুলো
--    01_dry_run.sql এর কাউন্টের সাথে মিলিয়ে নিশ্চিত হয়ে নিন।
-- ২. সব ঠিক লাগলে একদম শেষের `rollback;` লাইনটা `commit;` দিয়ে বদলে পুরো ফাইলটা আবার রান
--    করুন — তখন সত্যিকারের মোছা হবে। (দ্বিতীয়বার রান করলে DELETE গুলো একই ডেটার উপর আবার
--    চলবে, কিন্তু ততক্ষণে কিছু মোছাই হয়নি বলে ফলাফল প্রথমবারের মতোই থাকবে — সমস্যা নেই।)
--
-- FK নির্ভরতা অনুযায়ী সঠিক ক্রমে সাজানো (আগে child টেবিল, পরে parent)। messages টেবিল
-- partition করা (migration 0009: মাসভিত্তিক), কিন্তু parent টেবিলে সরাসরি DELETE করলে
-- PostgreSQL নিজে থেকেই সব partition জুড়ে প্রয়োগ করে — আলাদা করে প্রতিটা মাসের partition
-- (messages_2026_09, messages_2026_10, ...) ধরে ধরে মোছার দরকার নেই।

begin;

-- ১. অ্যানাউন্সমেন্ট (targets আগে, তারপর announcements — যদিও announcements মুছলে targets
--    এমনিতেই cascade হয়ে যেত, স্পষ্টতার জন্য আলাদাভাবে লেখা হলো)
delete from public.group_scheduled_announcement_targets;
delete from public.group_scheduled_announcements;

-- ২. গ্রুপ মেসেজ লগ (groups/group_members টেবিল অক্ষত থাকবে)
delete from public.group_messages;

-- ৩. অর্ডার (history আগে, তারপর orders — orders মুছলে history এমনিতেই cascade হতো)
delete from public.order_status_history;
delete from public.orders;

-- ৪. ১:১ কথোপকথন
delete from public.conversation_messages;
delete from public.conversations;

-- ৫. ক্যাম্পেইন + ডেলিভারি রিপোর্ট + stats (campaigns মুছলে messages/campaign_stats
--    এমনিতেই cascade হতো — কিন্তু messages টেবিল partitioned বলে স্পষ্টভাবে আগে থেকেই
--    সরাসরি ডিলিট করা হচ্ছে, cascade এর উপর নির্ভর না করে)
delete from public.messages;
delete from public.campaign_stats;
delete from public.campaigns;

-- ৬. কন্টাক্ট + ইমপোর্ট হিস্ট্রি
delete from public.contacts;
delete from public.contact_imports;

-- ৭. নোটিফিকেশন
delete from public.notifications;

-- ৮. ডিসকানেক্টেড/আটকে-থাকা ডুপ্লিকেট নাম্বার — শুধু offline/connecting, আর কোনো গ্রুপ
--    যুক্ত নেই এমন রো। online নাম্বার আর গ্রুপ-যুক্ত offline/connecting নাম্বার এই শর্তে
--    কখনোই মেলে না, তাই ছোঁয়া হবে না (01_dry_run.sql এ এই তিন ভাগ আলাদা করে দেখানো আছে)।
delete from public.whatsapp_numbers wn
where wn.status in ('offline', 'connecting')
  and not exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id);

-- এই লাইনটাই পরিবর্তন করবেন — যাচাইয়ের জন্য প্রথমবার rollback রেখেই রান করুন
rollback;
-- সব ঠিক থাকলে উপরের লাইনটা মুছে এটা লিখে পুরো ফাইল আবার রান করুন:
-- commit;
