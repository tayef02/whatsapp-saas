-- Phase ২: গ্রুপ মিডিয়া মেসেজ (ছবি/ভিডিও/ডকুমেন্ট/অডিও) ডাউনলোড করে সেভ রাখার জন্য প্রাইভেট
-- storage bucket। আপলোড (worker) আর রিড (ড্যাশবোর্ডে signed URL জেনারেট) দুটোই service_role/
-- admin client দিয়ে হয় (RLS বাইপাস), গ্রুপ-ownership যাচাই আগেই পেজ লেভেলে RLS দিয়ে হয়ে যায়,
-- তাই এই bucket এ আলাদা storage policy লাগছে না — RLS চালু থাকায় authenticated/anon
-- ডিফল্টভাবেই অ্যাক্সেস পাবে না।

insert into storage.buckets (id, name, public)
values ('group-media', 'group-media', false)
on conflict (id) do nothing;
