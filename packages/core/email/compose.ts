// প্রতিটা ইমেইলে system নিজে যোগ করে (টেমপ্লেট থেকে সরানো যায় না):
//   • ফুটার: কেন ইমেইল পেয়েছেন + আনসাবস্ক্রাইব লিংক + ব্যবসার নাম ও ঠিকানা
//   • হেডার: List-Unsubscribe + List-Unsubscribe-Post (Gmail/Yahoo এর one-click, RFC 8058)
//
// লিংক দুই রকম: ফুটারের লিংক /u/<token> (নিশ্চিতকরণ পেজ, GET এ কিছু বদলায় না — ইমেইল স্ক্যানার
// আগে লিংক খুলে ফেললেও কেউ ভুলে আনসাবস্ক্রাইব হয় না), আর হেডারের লিংক /api/unsubscribe/<token>
// (one-click POST এখানে আসে)।

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface UnsubscribeUrls {
  pageUrl: string;
  oneClickUrl: string;
}

// base = APP_PUBLIC_URL (শেষে / ছাড়া)। লিংক ইউজারের ইমেইলে যায়, তাই পাবলিক URL ছাড়া পাঠানো যাবে না
export function buildUnsubscribeUrls(base: string, token: string): UnsubscribeUrls {
  const cleanBase = base.replace(/\/+$/, "");
  return { pageUrl: `${cleanBase}/u/${token}`, oneClickUrl: `${cleanBase}/api/unsubscribe/${token}` };
}

export function buildListUnsubscribeHeaders(urls: UnsubscribeUrls): Record<string, string> {
  return {
    "List-Unsubscribe": `<${urls.oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export interface ComposeInput {
  html: string;
  text: string;
  urls: UnsubscribeUrls;
  businessName: string;
  postalAddress: string;
}

export function appendEmailFooter(input: ComposeInput): { html: string; text: string } {
  const business = escapeHtml(input.businessName);
  const address = escapeHtml(input.postalAddress);
  const link = escapeHtml(input.urls.pageUrl);

  const footerHtml =
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px" />` +
    `<p style="font-size:12px;line-height:1.5;color:#6b7280;margin:0">` +
    `আপনি ${business}-এর ইমেইল তালিকায় আছেন বলে এই ইমেইল পেয়েছেন। ` +
    `You are receiving this because you are on the ${business} email list.<br />` +
    `<a href="${link}" style="color:#6b7280">আনসাবস্ক্রাইব করুন / Unsubscribe</a><br />` +
    `${business} — ${address}` +
    `</p>`;

  const footerText =
    `\n\n--\n` +
    `আপনি ${input.businessName}-এর ইমেইল তালিকায় আছেন বলে এই ইমেইল পেয়েছেন।\n` +
    `You are receiving this because you are on the ${input.businessName} email list.\n` +
    `আনসাবস্ক্রাইব / Unsubscribe: ${input.urls.pageUrl}\n` +
    `${input.businessName} — ${input.postalAddress}\n`;

  // </body> থাকলে তার ঠিক আগে বসাই, নাহলে শেষে
  const bodyCloseIndex = input.html.toLowerCase().lastIndexOf("</body>");
  const html =
    bodyCloseIndex >= 0
      ? input.html.slice(0, bodyCloseIndex) + footerHtml + input.html.slice(bodyCloseIndex)
      : input.html + footerHtml;

  return { html, text: input.text + footerText };
}
