-- ১:১ ইনবক্স মিডিয়া (ছবি/ভিডিও/অডিও/ডকুমেন্ট) ডাউনলোড করে সেভ রাখার জন্য প্রাইভেট storage
-- bucket। এটা ব্যক্তিগত কাস্টমার কথোপকথনের ছবি হতে পারে, তাই কখনো public না।
--
-- group-media bucket এর (migration 0033) ঠিক একই প্যাটার্ন: কোনো storage policy নেই —
-- আপলোড (worker) আর রিড (ড্যাশবোর্ডে signed URL) দুটোই service_role/admin client দিয়ে হয়
-- (RLS বাইপাস করে), workspace-ownership যাচাই আগেই পেজ লেভেলে RLS-স্কোপড কোয়েরি দিয়ে হয়ে
-- যায় (conversation -> workspace member চেক), তাই authenticated/anon এর জন্য আলাদা কোনো
-- storage policy লাগছে না — RLS চালু থাকায় তারা ডিফল্টভাবেই এই bucket এ অ্যাক্সেস পাবে না।

insert into storage.buckets (id, name, public)
values ('inbox-media', 'inbox-media', false)
on conflict (id) do nothing;
