-- লাইভ টেস্টে দেখা গেছে OpenAI text-embedding-3-small এ ছোট প্রশ্ন বনাম ছোট প্যাসেজের
-- বাস্তবসম্মত cosine similarity সাধারণত ০.৩-০.৫ এর মধ্যে থাকে (এমনকি genuine ম্যাচেও) —
-- ডিফল্ট ০.৭৫ থ্রেশহোল্ড এত বেশি ছিল যে সত্যিকারের ম্যাচও কখনো পাস করত না। নতুন
-- workspace এর জন্য ডিফল্ট কমানো হলো; আগে থেকে থাকা workspace নিজে থেকে যা সেট করেছে
-- সেটা এখানে বদলানো হচ্ছে না (Settings পেজ থেকে যে কেউ নিজে বদলাতে পারবে)।
alter table public.workspace_ai_settings alter column confidence_threshold set default 0.5;
