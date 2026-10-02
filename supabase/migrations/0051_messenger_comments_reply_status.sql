-- ইউজার রিপোর্ট করেছিলেন worker লগে "[messenger-comment-reply] sent" থাকা সত্ত্বেও কমেন্ট
-- লগে "রিপ্লাই যায়নি" দেখাচ্ছিল। root cause: শুধু একটা boolean (reply_sent) দিয়ে পাবলিক/
-- প্রাইভেট, কবে পাঠানো হয়েছে, বা এখনো drip-queue তে বসে আছে কিনা — কিছুই আলাদা করা যেত না,
-- UI তে ভুল/অস্পষ্ট স্ট্যাটাস দেখানোর সুযোগ ছিল। এখন replied_at (কবে আসলেই পাঠানো হয়েছে) আর
-- reply_scheduled_at (drip-queue এ কখন পাঠানোর কথা) দিয়ে সঠিক স্ট্যাটাস দেখানো যাবে:
-- "পাবলিক/প্রাইভেট রিপ্লাই গেছে" (replied_at + action দিয়ে) / "কিউয়ে আছে (n মিনিট পরে)"
-- (action+queued_at আছে, replied_at নেই) / "স্কিপ হয়েছে (কারণ)" (messenger_comment_skips এ রো আছে)।
--
-- পেজ নিজে কমেন্ট করলে (নিজের public_reply, বা অ্যাডমিনের ম্যানুয়াল রিপ্লাই) আগে একেবারেই লগ
-- হতো না (own_page_comment স্কিপ early-return এ কোনো insert ছাড়াই)। এখন is_own_comment=true
-- দিয়ে লগ হবে, যাতে দেখা যায় এটা কাস্টমার-ইন্টারঅ্যাকশন না — কিন্তু messenger_comment_skips
-- এ কখনো রো যাবে না (রিভিউ-তালিকায় দরকার নেই, এটা স্কিপ না, স্বাভাবিক)।

alter table public.messenger_comments
  add column replied_at timestamptz,
  add column reply_scheduled_at timestamptz,
  add column is_own_comment boolean not null default false;

-- পুরনো ডাটা হারানো যাবে না — reply_sent=true ছিল এমন রো গুলোর জন্য created_at কে আনুমানিক
-- replied_at ধরা হলো (আসল পাঠানোর সময় আলাদা রাখা হতো না আগে)
update public.messenger_comments set replied_at = created_at where reply_sent = true;

alter table public.messenger_comments drop column reply_sent;
