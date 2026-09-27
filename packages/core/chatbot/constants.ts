export const KNOWLEDGE_BASE_BUCKET = "knowledge-base-docs";
export const MAX_KNOWLEDGE_BASE_FILE_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_BASE_QUEUE_NAME = "knowledge-base-process";

// workspace এর সব ready ডকুমেন্ট মিলিয়ে মোট শব্দ এর নিচে থাকলে পুরো টেক্সট সরাসরি LLM
// কে context হিসেবে দেওয়া হয় (chunk/embedding similarity সার্চ ছাড়াই) — এর বেশি হলে
// আগের chunk+retrieval পদ্ধতি ব্যবহার হয়
export const FULL_TEXT_MODE_MAX_WORDS = 5000;

// full-text mode এ LLM কে বলা হয় তথ্য না পেলে ঠিক এই টোকেনটা দিতে — প্রাকৃতিক ভাষায়
// "আমি জানি না" পার্স করার অনির্ভরযোগ্যতা এড়াতে একটা নির্দিষ্ট marker ব্যবহার করা হয়
export const NO_ANSWER_MARKER = "NEED_HUMAN_HANDOFF";
