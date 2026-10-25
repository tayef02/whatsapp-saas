import { verifySvixSignature } from "../email/svix";
import {
  EmailProviderError,
  type DnsGroupStatus,
  type DnsRecord,
  type EmailProvider,
  type NormalizedEmailEvent,
  type ProviderDomain,
  type SendEmailInput,
} from "./email-types";

const RESEND_API_BASE = "https://api.resend.com";
const DEFAULT_TIMEOUT_MS = 15_000;

interface ResendConfig {
  apiKey?: string;
  webhookSecret?: string;
}

// ⚠ সাধারণ API key (শুধু "Sending access") দিয়ে ডোমেইন তৈরি/যাচাই চলে না — ডোমেইন ম্যানেজ করতে
// "Full access" key লাগে। Resend এর রেট লিমিট: পুরো team এ ১০ রিকোয়েস্ট/সেকেন্ড।

// fetch() ব্যর্থ হলে (নেটওয়ার্ক/timeout) সবসময় transient — ইমেইল গিয়েও থাকতে পারে, তাই retry
// নিরাপদ রাখতে Idempotency-Key ব্যবহার হয়। এরর মেসেজে কখনো API key বা প্রাপকের ঠিকানা থাকে না।
async function resendFetch(apiKey: string, path: string, init: RequestInit, extraHeaders: Record<string, string> = {}): Promise<Response> {
  try {
    return await fetch(`${RESEND_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    throw new EmailProviderError("transient", `Resend রিকোয়েস্ট ব্যর্থ (${name})`);
  }
}

// প্রোভাইডারের এরর রেসপন্স থেকে শুধু এরর-নাম (যেমন validation_error) নেওয়া হয়, "message" না —
// message এ প্রাপকের ঠিকানা থাকতে পারে
async function toProviderError(res: Response): Promise<EmailProviderError> {
  let errorName = `http_${res.status}`;
  try {
    const body = (await res.json()) as { name?: string };
    if (body?.name) errorName = body.name;
  } catch {
    // বডি JSON না হলে http স্ট্যাটাসই যথেষ্ট
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    return new EmailProviderError("rate_limited", `Resend রেট লিমিট (${errorName})`, Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  if (res.status === 401 || res.status === 403) {
    return new EmailProviderError("auth", `Resend অনুমতি নেই (${errorName}) — API key যাচাই করুন`);
  }
  if (res.status >= 500) {
    return new EmailProviderError("transient", `Resend সার্ভার সমস্যা (${errorName})`);
  }
  return new EmailProviderError("rejected", `Resend অনুরোধ গ্রহণ করেনি (${errorName})`);
}

// ---- ডোমেইন রেকর্ডের স্ট্যাটাস ম্যাপিং ----
// Resend এর রেকর্ড status: not_started, pending, verified, failed, temporary_failure (সব মান ডকুমেন্টেশনে
// নিশ্চিত না) — "verified" ছাড়া আর কিছুই verified ধরা হয় না (নিরাপদ দিক)
function groupStatus(records: DnsRecord[]): DnsGroupStatus {
  if (records.length === 0) return "missing";
  if (records.some((r) => r.status === "failed")) return "failed";
  if (records.every((r) => r.status === "verified")) return "verified";
  return "pending";
}

interface ResendDomainBody {
  id?: string;
  name?: string;
  status?: string;
  records?: Array<{ record?: string; type?: string; name?: string; value?: string; priority?: number | null; status?: string }>;
}

function toProviderDomain(body: ResendDomainBody): ProviderDomain {
  const records: DnsRecord[] = (body.records ?? []).map((r) => ({
    record: String(r.record ?? ""),
    type: String(r.type ?? ""),
    name: String(r.name ?? ""),
    value: String(r.value ?? ""),
    priority: typeof r.priority === "number" ? r.priority : null,
    status: String(r.status ?? "pending"),
  }));

  const spfRecords = records.filter((r) => r.record.toUpperCase() === "SPF");
  const dkimRecords = records.filter((r) => r.record.toUpperCase() === "DKIM");

  return {
    providerDomainId: String(body.id ?? ""),
    name: String(body.name ?? ""),
    status: String(body.status ?? ""),
    spf: groupStatus(spfRecords),
    dkim: groupStatus(dkimRecords),
    records,
  };
}

// ---- webhook payload ----
interface ResendWebhookBody {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    tags?: Record<string, string> | Array<{ name?: string; value?: string }>;
    bounce?: { type?: string; subType?: string };
    click?: { link?: string };
  };
}

function readTags(tags: NonNullable<ResendWebhookBody["data"]>["tags"]): Record<string, string> {
  const result: Record<string, string> = {};
  if (!tags) return result;
  if (Array.isArray(tags)) {
    for (const t of tags) if (t?.name && typeof t.value === "string") result[t.name] = t.value;
  } else {
    for (const [k, v] of Object.entries(tags)) if (typeof v === "string") result[k] = v;
  }
  return result;
}

function linkDomain(link: string | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname;
  } catch {
    return null;
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  constructor(private config: ResendConfig) {}

  private requireKey(): string {
    if (!this.config.apiKey) throw new EmailProviderError("auth", "RESEND_API_KEY সেট করা নেই");
    return this.config.apiKey;
  }

  async send(input: SendEmailInput): Promise<{ providerMessageId: string }> {
    const apiKey = this.requireKey();

    const body: Record<string, unknown> = {
      from: `${input.from.name} <${input.from.address}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    };
    if (input.replyTo) body.reply_to = input.replyTo;
    if (input.headers) body.headers = input.headers;
    if (input.tags) body.tags = Object.entries(input.tags).map(([name, value]) => ({ name, value }));

    const res = await resendFetch(
      apiKey,
      "/emails",
      { method: "POST", body: JSON.stringify(body) },
      input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}
    );
    if (!res.ok) throw await toProviderError(res);

    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new EmailProviderError("transient", "Resend রেসপন্সে id নেই");
    return { providerMessageId: json.id };
  }

  async createDomain(name: string): Promise<ProviderDomain> {
    const res = await resendFetch(this.requireKey(), "/domains", { method: "POST", body: JSON.stringify({ name }) });
    if (!res.ok) throw await toProviderError(res);
    return toProviderDomain((await res.json()) as ResendDomainBody);
  }

  async getDomain(providerDomainId: string): Promise<ProviderDomain> {
    const res = await resendFetch(this.requireKey(), `/domains/${encodeURIComponent(providerDomainId)}`, { method: "GET" });
    if (!res.ok) throw await toProviderError(res);
    return toProviderDomain((await res.json()) as ResendDomainBody);
  }

  async verifyDomain(providerDomainId: string): Promise<void> {
    const res = await resendFetch(this.requireKey(), `/domains/${encodeURIComponent(providerDomainId)}/verify`, { method: "POST" });
    if (!res.ok) throw await toProviderError(res);
  }

  verifyWebhook(rawBody: string, getHeader: (name: string) => string | null): boolean {
    if (!this.config.webhookSecret) return false;
    return verifySvixSignature({
      rawBody,
      id: getHeader("svix-id"),
      timestamp: getHeader("svix-timestamp"),
      signatureHeader: getHeader("svix-signature"),
      secret: this.config.webhookSecret,
    });
  }

  normalizeEvents(payload: unknown, providerEventId: string): NormalizedEmailEvent[] {
    const body = payload as ResendWebhookBody | null;
    if (!body || typeof body.type !== "string") return [];

    const eventType = body.type.startsWith("email.") ? body.type.slice("email.".length) : body.type;
    const data = body.data ?? {};
    const detail: Record<string, unknown> = {};
    let bounceType: "hard" | "soft" | null = null;

    if (eventType === "bounced") {
      // bounce type এর সব মান ডকুমেন্টেশনে নিশ্চিত না — শুধু "Permanent" হলে hard, বাকি সব (অজানাসহ)
      // soft ধরা হয় (নিরাপদ দিক: একবারের অজানা বাউন্সে কাউকে স্থায়ী suppress করা হয় না)
      const rawType = String(data.bounce?.type ?? "").toLowerCase();
      bounceType = rawType === "permanent" ? "hard" : "soft";
      detail.bounce_type = data.bounce?.type ?? null;
      detail.bounce_sub_type = data.bounce?.subType ?? null;
    }
    if (eventType === "clicked") {
      detail.link_domain = linkDomain(data.click?.link);
    }

    return [
      {
        providerEventId,
        providerMessageId: data.email_id ?? null,
        eventType,
        bounceType,
        occurredAt: body.created_at ?? data.created_at ?? null,
        detail,
        tags: readTags(data.tags),
      },
    ];
  }
}
