-- ১. bigserial কলাম টেবিলের GRANT থেকে আলাদা একটা সিকোয়েন্স তৈরি করে, যেটার উপর
-- নিজস্ব permission লাগে (টেবিলের GRANT এতে কভার করে না) — এই মিসিং GRANT এর কারণে
-- orders insert "permission denied for sequence orders_order_number_seq" এরর দিয়ে
-- ব্যর্থ হচ্ছিল
grant usage, select on sequence public.orders_order_number_seq to authenticated, service_role;

-- ২. Evolution/WhatsApp মাঝেমধ্যে একই ইনকামিং মেসেজের জন্য messages.upsert ইভেন্ট
-- দুইবার পাঠায় (reconnect resync/network retry) — provider এর নিজস্ব মেসেজ আইডি
-- (key.id) সেভ করে ইউনিক কনস্ট্রেইন্ট দিয়ে ডুপ্লিকেট শনাক্ত/ব্লক করা হবে, যাতে একই
-- মেসেজে দুইবার AI রিপ্লাই না যায়
alter table public.conversation_messages
  add column provider_message_id text;

create unique index conversation_messages_provider_msg_idx
  on public.conversation_messages (conversation_id, provider_message_id)
  where provider_message_id is not null;
