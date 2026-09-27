-- ছোট/মাঝারি knowledge base এর জন্য পুরো ডকুমেন্ট টেক্সট সরাসরি LLM কে context হিসেবে
-- দেওয়া হবে (chunk-এর similarity-থ্রেশহোল্ড গেট ছাড়াই) — যাতে LLM নিজে "পুরো শীট পড়ে"
-- যেকোনো ফর্মের প্রশ্নের উত্তর বুঝে বলতে পারে, শুধু একটা নির্দিষ্ট chunk-এর কাছাকাছি
-- মিল খুঁজে না। বড় ডকুমেন্টের জন্য আগের chunk+embedding retrieval অপরিবর্তিত থাকছে
-- (ব্যাকআপ হিসেবে), সেজন্য chunk/embedding প্রসেসিং আগের মতোই সবসময় হবে।
alter table public.knowledge_base_documents
  add column full_text text,
  add column word_count integer not null default 0;
