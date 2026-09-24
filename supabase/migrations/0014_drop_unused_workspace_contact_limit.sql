-- মডিউল ৩ এ workspaces.contact_limit একটা placeholder কলাম হিসেবে যোগ হয়েছিল
-- ("প্ল্যান সিস্টেম আসলে এখানে সংখ্যা বসবে")। মডিউল ৭ এ আসলে plans.contact_limit
-- ব্যবহার হচ্ছে (প্রতিটা প্ল্যানের নিজের লিমিট, workspace-ভিত্তিক না) — তাই এই কলামটা
-- এখন অব্যবহৃত, কোনো কোডে রেফারেন্স নেই। পরিষ্কারের জন্য ড্রপ করা হলো।
alter table public.workspaces drop column if exists contact_limit;
