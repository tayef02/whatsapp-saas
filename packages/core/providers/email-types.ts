// ইমেইল চ্যানেলের জন্য আলাদা ইন্টারফেস (WhatsAppProvider / MessengerProvider থেকে সম্পূর্ণ আলাদা)।
// এখন শুধু Resend (বিটা) ইমপ্লিমেন্ট হয়েছে; লঞ্চে Amazon SES যোগ করতে নতুন একটা ফাইল +
// providers/email.ts এর getEmailProvider() এ একটা লাইন — বাকি কোড অপরিবর্তিত।

// প্রোভাইডার এরর শ্রেণি — retry-নীতি এর উপর নির্ভর করে:
//   rate_limited — পরে আবার চেষ্টা করা যায় (retryAfterSeconds থাকতে পারে)
//   auth         — API key ভুল/অনুমতি নেই, retry করে লাভ নেই, অ্যাডমিনকে জানাতে হবে
//   transient    — নেটওয়ার্ক/সার্ভার সমস্যা, পরে আবার চেষ্টা করা যায় (ইমেইল গিয়েও থাকতে পারে)
//   rejected     — প্রোভাইডার অনুরোধই গ্রহণ করেনি (ভুল ডেটা ইত্যাদি), retry নয়
export type EmailErrorKind = "rate_limited" | "auth" | "transient" | "rejected";

export class EmailProviderError extends Error {
  constructor(
    public kind: EmailErrorKind,
    message: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

export interface SendEmailInput {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  // প্রোভাইডারের tag — webhook ইভেন্টে ফেরত আসে (ws = workspace id, kind ইত্যাদি)। মান শুধু
  // ASCII অক্ষর/সংখ্যা/_/- (Resend এর নিয়ম)
  tags?: Record<string, string>;
  // একই key দিয়ে আবার পাঠালে প্রোভাইডার ডাবল পাঠায় না (retry নিরাপদ)
  idempotencyKey?: string;
}

export interface DnsRecord {
  record: string; // "SPF" | "DKIM" | ...
  type: string; // TXT | MX | CNAME
  name: string;
  value: string;
  priority: number | null;
  status: string;
}

export type DnsGroupStatus = "missing" | "pending" | "verified" | "failed";

export interface ProviderDomain {
  providerDomainId: string;
  name: string;
  spf: DnsGroupStatus;
  dkim: DnsGroupStatus;
  records: DnsRecord[];
}

// প্রোভাইডারের ইভেন্ট একই চেহারায় — বাকি কোড প্রোভাইডার-নিরপেক্ষ
export interface NormalizedEmailEvent {
  providerEventId: string;
  providerMessageId: string | null;
  eventType: string; // delivered, bounced, complained, opened, clicked, failed ...
  bounceType: "hard" | "soft" | null;
  occurredAt: string | null;
  // শুধু দরকারি অংশ — প্রাপকের ঠিকানা, সাবজেক্ট, বডি কখনো না
  detail: Record<string, unknown>;
  tags: Record<string, string>;
}

export interface EmailProvider {
  readonly name: "resend" | "ses";

  send(input: SendEmailInput): Promise<{ providerMessageId: string }>;

  createDomain(name: string): Promise<ProviderDomain>;
  getDomain(providerDomainId: string): Promise<ProviderDomain>;
  // প্রোভাইডারকে DNS আবার যাচাই করতে বলে (ফলাফল পরে getDomain এ দেখা যায়)
  verifyDomain(providerDomainId: string): Promise<void>;

  // raw body + হেডার দিয়ে signature যাচাই — মিললে true
  verifyWebhook(rawBody: string, getHeader: (name: string) => string | null): boolean;
  // webhook payload কে সাধারণ ইভেন্টে রূপান্তর। providerEventId = svix-id হেডার
  normalizeEvents(payload: unknown, providerEventId: string): NormalizedEmailEvent[];
}
