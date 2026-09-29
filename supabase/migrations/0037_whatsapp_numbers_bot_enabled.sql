-- নাম্বার পেজের "বট অন/অফ" টগল — আগে chatbot_configs টেবিলে লেখা হতো, কিন্তু সেই টেবিল
-- migration 0021 এ ড্রপ হয়ে গিয়েছিল (n8n AI Agent স্টাইলে সবসময়-চালু ডিজাইনে সরে যাওয়ার সময়),
-- ফলে টগলটা প্রোডাকশনে কোনো কাজই করছিল না (কোয়েরি এরর সাইলেন্টলি null হয়ে যাচ্ছিল)।
-- নতুন টেবিল না বানিয়ে whatsapp_numbers এ সরাসরি কলাম যোগ করা হলো — এক নাম্বারের একটাই সারি,
-- তাই আলাদা টেবিলের দরকার ছিল না।
alter table public.whatsapp_numbers
  add column bot_enabled boolean not null default true;

-- নোট: whatsapp_numbers এর GRANT টেবিল-লেভেলে (migration 0003: "grant select, insert, update,
-- delete on public.whatsapp_numbers to authenticated"), কলাম-লেভেল GRANT না — তাই নতুন কলাম
-- এমনিতেই কভার হয়ে যায়, আলাদা GRANT লাগে না (bigserial sequence এর মতো আলাদা GRANT দরকার
-- হয় শুধু auto-generated sequence এর ক্ষেত্রে, plain কলামে না)। RLS policy-ও already
-- row-level (workspace member/admin চেক করে), নতুন কলাম যোগ হওয়ায় policy বদলানোর দরকার নেই।
