-- চ্যাটবটকে n8n AI Agent node-এর মতো করা হলো: system prompt-ই একমাত্র নিয়ন্ত্রক।
-- per-number Auto-Reply on/off, welcome/fallback message — সব সরানো হলো। AI Chatbot
-- এখন সবসময় চালু (workspace-এ provider/key সেট থাকলে) প্রতিটা কানেক্টেড নাম্বারে।
-- fallback আর fixed মেসেজ না — LLM নিজে system prompt অনুযায়ী প্রাকৃতিক ভাষায় বলে।
-- শুধু প্রকৃত টেকনিক্যাল ব্যর্থতার (key নেই/এরর) জন্য একটা generic safety-net মেসেজ +
-- সাপোর্ট নাম্বার থাকবে।
drop table if exists public.chatbot_configs;

alter table public.workspace_ai_settings
  add column support_phone text;

grant update (support_phone) on public.workspace_ai_settings to authenticated;
grant insert (support_phone) on public.workspace_ai_settings to authenticated;
