// Messenger এর নিজস্ব AI চ্যাটবট/নলেজ বেস সংক্রান্ত ধ্রুবক — WhatsApp এর
// packages/core/chatbot/constants.ts থেকে ইচ্ছাকৃতভাবে আলাদা ফাইলে (চ্যানেল বিচ্ছিন্নতা নিয়ম,
// CLAUDE.md দেখুন)। ফাইল আপলোড সাইজ/টাইপ সীমা, chunk/history/marker এর মতো prompt-মেকানিক্স
// ধ্রুবক (MAX_HISTORY_MESSAGES, NO_ANSWER_MARKER ইত্যাদি) WhatsApp এর constants.ts থেকেই
// reuse হয় (ai-reply.ts তে) — ওগুলো কোনো টেবিল/বাকেট রেফার করে না, শুধু prompt মেকানিক্স,
// তাই আলাদা করার দরকার নেই।
export const MESSENGER_KNOWLEDGE_BASE_QUEUE_NAME = "messenger-knowledge-base-process";
