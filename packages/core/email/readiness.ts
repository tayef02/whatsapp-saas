// "ইমেইল পাঠানোর জন্য প্রস্তুত" কিনা — প্ল্যাটফর্ম ডোমেইন + workspace এর sender প্রোফাইল মিলিয়ে।
// সেটিংস পেজ (চেকলিস্ট দেখাতে), টেস্ট ইমেইল (পাঠানোর আগে গেট), আর পরে ক্যাম্পেইন গেটে ব্যবহার হয়।

export interface ReadinessDomain {
  status: string;
  is_active: boolean;
}

export interface ReadinessProfile {
  from_name: string | null;
  reply_to_email: string | null;
  reply_to_verified_at: string | null;
  business_name: string | null;
  postal_address: string | null;
}

export interface ReadinessItem {
  key: "domain" | "from_name" | "reply_to" | "business";
  label: string;
  ok: boolean;
}

export function getEmailReadiness(domain: ReadinessDomain | null, profile: ReadinessProfile | null): { ready: boolean; items: ReadinessItem[] } {
  const items: ReadinessItem[] = [
    { key: "domain", label: "প্ল্যাটফর্ম ডোমেইন যাচাই হয়েছে (SPF, DKIM, DMARC)", ok: Boolean(domain && domain.is_active && domain.status === "verified") },
    { key: "from_name", label: "From নাম সক্রিয়", ok: Boolean(profile?.from_name) },
    { key: "reply_to", label: "Reply-To ঠিকানা যাচাই হয়েছে", ok: Boolean(profile?.reply_to_email && profile.reply_to_verified_at) },
    { key: "business", label: "ব্যবসার নাম ও ঠিকানা দেওয়া আছে", ok: Boolean(profile?.business_name && profile.postal_address) },
  ];
  return { ready: items.every((i) => i.ok), items };
}
