-- ১:১ ইনবক্সে কাস্টমারের পাঠানো ছবি/ভিডিও/অডিও/ডকুমেন্ট দেখানোর জন্য — এতদিন এসব মেসেজ
-- সাইলেন্টলি বাদ যেত (শুধু টেক্সট/ক্যাপশন থাকলেই সেভ হতো, খালি মিডিয়া কখনো না)। গ্রুপ মেসেজ
-- লগে (group_messages.media_type/media_url, migration 0030) এই একই দরকারে কলাম আগে থেকেই
-- আছে, এখানে conversation_messages এ ঠিক সেই প্যাটার্নেই যোগ করা হলো।

alter table public.conversation_messages
  add column media_path text,
  add column media_type text check (media_type in ('image', 'document', 'video', 'audio', 'sticker'));

-- নোট: conversation_messages এর GRANT টেবিল-লেভেলে (migration 0015: "grant select, insert,
-- update, delete ... to authenticated, service_role") আর RLS policy row-লেভেলে (conversation_id
-- দিয়ে workspace member যাচাই করে) — দুটোই নতুন প্লেইন কলামে (bigserial/sequence না) এমনিতেই
-- কভার হয়ে যায়, আলাদা কিছু লাগে না।
