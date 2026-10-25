// apps/web/lib/queue/email-queues.ts এর সাথে নাম মিলতে হবে। ইমেইলের queue WhatsApp/Messenger
// থেকে সম্পূর্ণ আলাদা
export const EMAIL_WEBHOOK_QUEUE_NAME = "email-webhook-events";
export const EMAIL_JOBS_QUEUE_NAME = "email-jobs";
// শুধু worker এর নিজস্ব (দিনে একবার ডোমেইন রিচেক) — web এ এর কোনো প্রতিরূপ নেই
export const EMAIL_DOMAIN_CHECK_QUEUE_NAME = "email-domain-check";
