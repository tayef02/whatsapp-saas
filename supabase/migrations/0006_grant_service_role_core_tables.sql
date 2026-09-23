-- ফিক্স: profiles/workspaces/workspace_members টেবিলে service_role এর explicit
-- GRANT ছিল না (মডিউল ১ এ শুধু authenticated পেয়েছিল)। এতদিন সমস্যা হয়নি কারণ
-- এই টেবিলগুলো সবসময় ইউজারের নিজের RLS-স্কোপড ক্লায়েন্ট বা security definer RPC
-- দিয়ে অ্যাক্সেস হতো। কিন্তু ভবিষ্যতে worker/admin ক্লায়েন্ট থেকে সরাসরি এগুলো
-- পড়ার দরকার হতে পারে (যেমন rate limit চেক করতে workspaces.daily_message_limit),
-- তাই আগে থেকেই GRANT দিয়ে রাখা হলো।

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.workspaces to service_role;
grant select, insert, update, delete on public.workspace_members to service_role;
