-- Keyword-rule সিস্টেম সরিয়ে ফেলা হলো — এখন থেকে সব ইনকামিং মেসেজ সরাসরি AI/knowledge-base
-- RAG ফ্লো তে যায়, কোনো rule-matching ধাপ ছাড়াই। fallback + handoff ফ্লো অপরিবর্তিত।
drop table if exists public.chatbot_rules;
