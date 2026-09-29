-- 02_delete.sql তে commit করার পর এই ফাইল চালিয়ে যাচাই করুন সব ঠিকভাবে মুছেছে কিনা।
--
-- প্রত্যাশিত ফলাফল:
--   contacts, conversation_messages, conversations, messages, campaign_stats, campaigns,
--   order_status_history, orders, group_messages, group_scheduled_announcement_targets,
--   group_scheduled_announcements, notifications, contact_imports  → সব 0
--   whatsapp_numbers — মুছে ফেলা হবে (...)                          → 0
--   whatsapp_numbers — স্কিপ হবে (...) / রাখা হবে (online) / রাখা হবে (banned)
--     → 01_dry_run.sql তে যা দেখেছিলেন ঠিক তাই (এগুলো অপরিবর্তিত থাকার কথা)

select 'contacts' as item, count(*) as row_count from public.contacts
union all
select 'conversation_messages', count(*) from public.conversation_messages
union all
select 'conversations', count(*) from public.conversations
union all
select 'messages (ক্যাম্পেইন মেসেজ/ডেলিভারি রিপোর্ট, সব মাসের partition মিলিয়ে)', count(*) from public.messages
union all
select 'campaign_stats', count(*) from public.campaign_stats
union all
select 'campaigns', count(*) from public.campaigns
union all
select 'order_status_history', count(*) from public.order_status_history
union all
select 'orders', count(*) from public.orders
union all
select 'group_messages', count(*) from public.group_messages
union all
select 'group_scheduled_announcement_targets', count(*) from public.group_scheduled_announcement_targets
union all
select 'group_scheduled_announcements', count(*) from public.group_scheduled_announcements
union all
select 'notifications', count(*) from public.notifications
union all
select 'contact_imports', count(*) from public.contact_imports
union all
select 'whatsapp_numbers — মুছে ফেলা হবে (offline/connecting, কোনো গ্রুপ যুক্ত নেই)', count(*)
  from public.whatsapp_numbers wn
  where wn.status in ('offline', 'connecting')
    and not exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id)
union all
select 'whatsapp_numbers — স্কিপ হবে (offline/connecting কিন্তু গ্রুপ যুক্ত আছে)', count(*)
  from public.whatsapp_numbers wn
  where wn.status in ('offline', 'connecting')
    and exists (select 1 from public.groups g where g.whatsapp_number_id = wn.id)
union all
select 'whatsapp_numbers — রাখা হবে (online)', count(*)
  from public.whatsapp_numbers
  where status = 'online'
union all
select 'whatsapp_numbers — রাখা হবে (banned)', count(*)
  from public.whatsapp_numbers
  where status = 'banned';

-- বাকি সব ঠিক থাকার কথা (এগুলো কখনোই ছোঁয়া হয়নি) — শুধু নিশ্চিত হওয়ার জন্য একটা কাউন্ট:
select 'workspaces' as item, count(*) as row_count from public.workspaces
union all
select 'plans', count(*) from public.plans
union all
select 'payments', count(*) from public.payments
union all
select 'templates', count(*) from public.templates
union all
select 'groups', count(*) from public.groups
union all
select 'group_members', count(*) from public.group_members
union all
select 'group_keyword_replies', count(*) from public.group_keyword_replies
union all
select 'workspace_group_filters', count(*) from public.workspace_group_filters
union all
select 'workspace_ai_settings', count(*) from public.workspace_ai_settings
union all
select 'knowledge_base_documents', count(*) from public.knowledge_base_documents
union all
select 'knowledge_base_chunks', count(*) from public.knowledge_base_chunks
union all
select 'evolution_servers', count(*) from public.evolution_servers;
