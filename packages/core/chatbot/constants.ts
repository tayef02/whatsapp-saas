export const KNOWLEDGE_BASE_BUCKET = "knowledge-base-docs";
export const MAX_KNOWLEDGE_BASE_FILE_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_BASE_QUEUE_NAME = "knowledge-base-process";

// workspace এর সব ready ডকুমেন্ট মিলিয়ে মোট শব্দ এর নিচে থাকলে পুরো টেক্সট সরাসরি LLM
// কে context হিসেবে দেওয়া হয় (chunk/embedding similarity সার্চ ছাড়াই) — এর বেশি হলে
// আগের chunk+retrieval পদ্ধতি ব্যবহার হয়
export const FULL_TEXT_MODE_MAX_WORDS = 5000;

// LLM কে বলা হয়, উত্তর দিতে না পারলে (knowledge base এ তথ্য নেই) নিজের উত্তরের একদম
// শুরুতে এই মার্কারটা বসাতে (কাস্টমার এটা দেখবে না, পাঠানোর আগে ছেঁটে ফেলা হয়) — বাকি
// অংশটা LLM এর নিজের ভাষায় লেখা "জানি না" বার্তা, system prompt এর নির্দেশ অনুযায়ী।
// প্রাকৃতিক ভাষায় "আমি জানি না" পার্স করার অনির্ভরযোগ্যতা এড়াতে এই পদ্ধতি।
export const NO_ANSWER_MARKER = "NEED_HUMAN_HANDOFF";

// n8n AI Agent node এর মতো — কথোপকথনের সাম্প্রতিক এই কয়েকটা turn LLM কে context
// হিসেবে দেওয়া হয়, যাতে "Table Clock কিনতে চাই" এর মতো মেসেজে আগের প্রসঙ্গ মনে থাকে
export const MAX_HISTORY_MESSAGES = 10;

// অর্ডার কনফার্ম হলে LLM কে এই ট্যাগের মধ্যে JSON বসাতে বলা হয় — কাস্টমারকে দেখানোর আগে
// worker এই ব্লকটা ছেঁটে ফেলে, শুধু ভিতরের JSON পার্স করে orders টেবিলে সেভ করে
export const ORDER_BLOCK_START = "[ORDER_CONFIRMED]";
export const ORDER_BLOCK_END = "[/ORDER_CONFIRMED]";
