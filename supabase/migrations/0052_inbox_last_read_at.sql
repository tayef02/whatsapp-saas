-- ইনবক্সে সঠিক "অপঠিত" — প্রতিটা কথোপকথনে last_read_at (শেষবার কেউ খুলে দেখেছে কখন)।
-- দুই চ্যানেলের কলাম আলাদা (WhatsApp: conversations, Messenger: messenger_conversations) —
-- কোনো শেয়ার্ড টেবিল/কলাম নেই (CLAUDE.md "চ্যানেল বিচ্ছিন্নতা")।
--
-- অর্থ:
--   "অপঠিত"      = কাস্টমারের শেষ ইনবাউন্ড মেসেজ last_read_at এর পরে এসেছে (বা last_read_at NULL)
--   "উত্তর বাকি"  = কথোপকথনের শেষ মেসেজই ইনবাউন্ড (কেউ রিপ্লাই দেয়নি) — এটা আগের heuristic,
--                    এখন আলাদা ট্যাব, অ্যাপ কোডে হিসাব হয়, এই মাইগ্রেশনে কিছু লাগে না
--
-- GRANT/RLS: নতুন টেবিল নেই। দুই টেবিলেই আগে থেকে টেবিল-লেভেল
-- "grant select, insert, update, delete ... to authenticated, service_role" আর member-ভিত্তিক
-- RLS পলিসি আছে (0015, 0041) — নতুন কলাম এগুলোর আওতায় স্বয়ংক্রিয়ভাবে পড়ে, আলাদা GRANT/
-- পলিসি লাগে না। ইউজার শুধু নিজের workspace এর কথোপকথনের last_read_at বদলাতে পারবে।
--
-- ============================================================
-- ⚠ লাইভ টেবিলের ঝুঁকি (চালানোর আগে পড়ুন)
-- ============================================================
-- ১. ALTER TABLE ... ADD COLUMN সংক্ষিপ্ত সময়ের জন্য ACCESS EXCLUSIVE লক নেয় — চলমান
--    ট্রানজেকশন (webhook/worker এর conversation upsert) শেষ না হওয়া পর্যন্ত অপেক্ষা করে, আর
--    সেই সময় নতুন কুয়েরি লাইনে দাঁড়ায়। সাধারণত মিলিসেকেন্ড, তবে ব্যস্ত সময়ে না চালানো ভালো।
-- ২. ব্যাকফিল আলাদা UPDATE দিয়ে না করে "ADD COLUMN ... DEFAULT now()" দিয়ে করা হয়েছে:
--    PostgreSQL 11+ এ now() (STABLE, non-volatile) ডিফল্ট দিয়ে কলাম যোগ করলে টেবিল রিরাইট
--    হয় না — বিদ্যমান সব রো-র মান ALTER চলার মুহূর্তের সময় হয়ে যায় (= "সব পঠিত", যাতে
--    হঠাৎ সব কথোপকথন অপঠিত না দেখায়)। পুরো টেবিলে বড় UPDATE (bloat, দীর্ঘ রো-লক) এড়ানো গেল।
-- ৩. তারপর DROP DEFAULT — নইলে নতুন কথোপকথন তৈরির মুহূর্তেই "পঠিত" ধরা হতো এবং প্রথম
--    ইনবাউন্ড মেসেজটা (প্রায় একই timestamp) অপঠিত দেখাত না। DROP DEFAULT বিদ্যমান রো-র মান
--    বদলায় না; নতুন রো-তে last_read_at NULL থাকবে (= কিছু ইনবাউন্ড এলেই অপঠিত)।
-- ৪. রোলব্যাক: alter table ... drop column last_read_at (ডেটা-লস নেই, শুধু এই কলামের মান যায়)।
--    অ্যাপ কোড ডিপ্লয়ের আগে এই মাইগ্রেশন চালাতে হবে, নাহলে ইনবক্সের কোয়েরি "column
--    does not exist" এরর দেবে।

alter table public.conversations
  add column last_read_at timestamptz default now();
alter table public.conversations
  alter column last_read_at drop default;

alter table public.messenger_conversations
  add column last_read_at timestamptz default now();
alter table public.messenger_conversations
  alter column last_read_at drop default;
