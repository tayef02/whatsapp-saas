// email_contact_skips.reason এর বাংলা লেবেল — ইম্পোর্ট সারাংশ পেজে দেখানোর জন্য

export const EMAIL_SKIP_REASON_LABELS: Record<string, string> = {
  empty_email: "ইমেইল ঘর ফাঁকা",
  invalid_format: "ইমেইল ঠিকানার ফরম্যাট ভুল",
  duplicate_in_file: "ফাইলে একই ঠিকানা আগেও ছিল",
  already_in_list: "আগে থেকেই তালিকায় আছে",
  suppressed_unsubscribed: "আনসাবস্ক্রাইব করা (আর পাঠানো যাবে না)",
  suppressed_hard_bounce: "ঠিকানা অকার্যকর (hard bounce)",
  suppressed_repeated_soft_bounce: "বারবার বাউন্স করেছে",
  suppressed_complaint: "স্প্যাম রিপোর্ট করেছে",
  suppressed_manual: "মালিক ব্লক করেছেন",
};

export const EMAIL_SKIP_REASONS = Object.keys(EMAIL_SKIP_REASON_LABELS);

export function emailSkipReasonLabel(reason: string): string {
  return EMAIL_SKIP_REASON_LABELS[reason] ?? reason;
}
