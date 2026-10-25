import { EmailProviderError, type EmailProvider } from "./email-types";
import { ResendEmailProvider } from "./resend";

// প্রোভাইডার বাছাই এই একটাই জায়গায় (EMAIL_PROVIDER env, ডিফল্ট resend)। লঞ্চে SES এ সরাতে
// এখানে একটা শাখা যোগ + EMAIL_PROVIDER=ses — বাকি কোডে কোনো বদল লাগবে না।
// API key না থাকলেও এটা throw করে না (webhook যাচাই শুধু signing secret দিয়ে চলে); key লাগে
// এমন মেথড (send/domain) কল হলে তখন "auth" এরর দেয়।
export function getEmailProvider(): EmailProvider {
  const name = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();

  if (name === "resend") {
    return new ResendEmailProvider({
      apiKey: process.env.RESEND_API_KEY,
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });
  }

  throw new EmailProviderError("rejected", `EMAIL_PROVIDER="${name}" সাপোর্টেড নয়`);
}
