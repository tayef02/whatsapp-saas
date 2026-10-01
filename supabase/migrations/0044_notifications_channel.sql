-- Phase ১ (চ্যানেল বিচ্ছিন্নতা): notifications টেবিলে কোনো channel কলাম ছিল না — কোন
-- নোটিফিকেশন কোন চ্যানেলের (WhatsApp/Messenger) সেটা শুধু title এর বাংলা টেক্সট পড়ে বোঝা
-- যেত, কোয়েরি করা যেত না। টপবারের বেল এখন channel-সচেতন (সক্রিয় চ্যানেল সেকশনে থাকলে শুধু
-- সেই চ্যানেলের নোটিফিকেশন দেখাবে) — এই কলাম ছাড়া সেটা সম্ভব না।
--
-- ⚠️ notifications লাইভ টেবিল, নিয়মিত insert হয় — কম-ট্রাফিকের সময় চালানোর পরামর্শ। তবে
-- nullable কলাম যোগ করা (DEFAULT ছাড়া) PostgreSQL এ metadata-only অপারেশন, টেবিল রিরাইট
-- হয় না, তাই দ্রুত শেষ হওয়ার কথা।
--
-- ইচ্ছাকৃতভাবে nullable, কোনো DEFAULT নেই — subscription-maintenance এর মতো কিছু
-- নোটিফিকেশন চ্যানেল-নিরপেক্ষ (অ্যাকাউন্ট-লেভেল, যেমন প্ল্যান মেয়াদ শেষ হওয়ার অ্যালার্ট),
-- সেগুলোর channel NULL থাকবে আর বেল সবসময় সেগুলো দেখাবে (সক্রিয় চ্যানেল যা-ই হোক)।
-- পুরনো রো (এই migration এর আগে তৈরি) ও NULL থাকবে — সেগুলো সবই WhatsApp যুগের
-- নোটিফিকেশন ছিল, কিন্তু backfill করা হচ্ছে না (শুধু পুরনো ডেটা, নতুন ফিচারে প্রভাব নেই)।
alter table public.notifications
  add column channel text check (channel in ('whatsapp', 'messenger'));

-- বেল এর সবচেয়ে সাধারণ কোয়েরি: workspace + (channel ম্যাচ অথবা channel is null) +
-- created_at desc
create index notifications_workspace_channel_idx on public.notifications (workspace_id, channel, created_at desc);

-- নোট: কোনো নতুন টেবিল না, শুধু বিদ্যমান টেবিলে কলাম — আলাদা GRANT/RLS লাগে না
-- (notifications এর বিদ্যমান GRANT/policy, migration 0009, সব কলাম কভার করে)।
