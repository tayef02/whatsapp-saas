-- Phase ২, আইটেম ৭: গ্রুপের "ORDER:" structured ক্যাপচারে (process-webhook.ts) BullMQ job
-- retry হলে (attempts: 3 সেট করা আছে) পুরো handleGroupMessage() আবার চলে, আর orders.insert()
-- এ কোনো idempotency key ছিল না — তাই একই মেসেজ থেকে retry এ দ্বিতীয়বার একই অর্ডার আবার
-- insert হয়ে যেত (ডুপ্লিকেট)। এই কলাম + unique index সেটা ঠেকায় (conversation_messages_
-- provider_msg_idx/messenger_messages_provider_msg_idx এর ঠিক একই dedup প্যাটার্ন)।
--
-- ⚠️ orders লাইভ টেবিল — কম-ট্রাফিকের সময় চালানোর পরামর্শ। nullable কলাম + partial unique
-- index (DEFAULT ছাড়া), metadata-only অপারেশন, দ্রুত শেষ হওয়ার কথা।
--
-- শুধু workspace_id + provider_message_id (contact_phone/conversation_id না) দিয়ে ইউনিক —
-- WhatsApp এর message id (Baileys key.id) ওয়ার্কস্পেসের মধ্যে প্র্যাকটিক্যালি ইউনিক।
-- AI-চ্যাট থেকে সেভ হওয়া অর্ডারে (ai-reply.ts এর saveOrder) আপাতত provider_message_id
-- পাস করা হচ্ছে না (nullable, partial index তাই প্রভাবিত হয় না) — সেখানে একই ধরনের retry
-- ঝুঁকি তাত্ত্বিকভাবে থাকতে পারে, কিন্তু এই মাইগ্রেশনের স্কোপ শুধু গ্রুপের regex ক্যাপচার
-- (ইউজার যা চেয়েছেন); ai-reply.ts এ wiring করতে চাইলে এই একই কলাম reuse করা যাবে, আলাদা
-- মাইগ্রেশন লাগবে না।
alter table public.orders
  add column provider_message_id text;

create unique index orders_workspace_provider_msg_idx
  on public.orders (workspace_id, provider_message_id)
  where provider_message_id is not null;
