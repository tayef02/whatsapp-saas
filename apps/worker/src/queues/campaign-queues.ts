// রোলিং-হরাইজন শিডিউলার (প্রতি মিনিটে চলে, Phase A+B) — repeatable job
export const CAMPAIGN_SCHEDULER_QUEUE_NAME = "campaign-scheduler";
// একটা একটা মেসেজ পাঠানোর আসল job — শিডিউলার এতে অল্প-সময়ের delay দিয়ে job বসায়
export const CAMPAIGN_SEND_QUEUE_NAME = "campaign-send";
