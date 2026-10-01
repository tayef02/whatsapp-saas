// Messenger কমেন্ট পাইপলাইন ম্যানুয়ালি টেস্ট করার স্ক্রিপ্ট — Meta-র "feed" webhook ইভেন্টের
// ঠিক একই আকারের একটা নকল payload বানিয়ে, আসল MESSENGER_APP_SECRET দিয়ে sign করে, লোকাল
// /api/webhooks/messenger এ POST করে। এটা রুল-ম্যাচিং, লগিং, আর queue/worker পাইপলাইন
// পরীক্ষা করে — কিন্তু comment_id/post_id নকল হওয়ায় worker যখন আসল Meta API কে রিপ্লাই
// পাঠানোর চেষ্টা করবে, সেটা ব্যর্থ হবে (এটা প্রত্যাশিত, নিচে docs এ ব্যাখ্যা আছে)।
//
// ব্যবহার:
//   npx tsx scripts/test-messenger-comment.ts <page_id> "<কমেন্টের লেখা>" [webhook_url]
//
// বিস্তারিত: docs/messenger-plan.md এর "M3 — টেস্ট স্ক্রিপ্ট দিয়ে যাচাই" সেকশন দেখুন।

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_WEBHOOK_URL = "http://localhost:3000/api/webhooks/messenger";
const WEB_ENV_PATH = path.resolve(__dirname, "..", "apps/web/.env.local");

// নিজের জন্যই ছোট .env পার্সার — dotenv নতুন dependency যোগ না করে, শুধু KEY=VALUE লাইন পড়ে
function parseEnvFile(filePath: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function printUsageAndExit(): never {
  console.error("ব্যবহার: npx tsx scripts/test-messenger-comment.ts <page_id> \"<কমেন্টের লেখা>\" [webhook_url]");
  console.error("  page_id      — কানেক্টেড Messenger পেজের আসল Facebook page_id (messenger_pages টেবিলে দেখুন)");
  console.error("  কমেন্টের লেখা — কোট দিয়ে ঘিরে দিন, যেমন \"দাম কত?\"");
  console.error("  webhook_url  — ডিফল্ট: " + DEFAULT_WEBHOOK_URL);
  process.exit(1);
}

async function main() {
  const [, , pageId, commentText, webhookUrlArg] = process.argv;
  if (!pageId || !commentText) printUsageAndExit();

  const env = parseEnvFile(WEB_ENV_PATH);
  const appSecret = env.MESSENGER_APP_SECRET || process.env.MESSENGER_APP_SECRET;
  if (!appSecret) {
    console.error(`MESSENGER_APP_SECRET পাওয়া যায়নি (চেক করা হয়েছে: ${WEB_ENV_PATH})`);
    process.exit(1);
  }

  const webhookUrl = webhookUrlArg || DEFAULT_WEBHOOK_URL;

  // নকল আইডি — আসল Meta কমেন্ট না, তাই worker যখন এই comment_id দিয়ে Meta কে রিপ্লাই
  // পাঠানোর চেষ্টা করবে সেটা ব্যর্থ হবে (এটাই প্রত্যাশিত, রুল-ম্যাচিং/লগ/queue পর্যন্ত যাচাই হলেই যথেষ্ট)
  const fakeCommentId = `test_comment_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const fakePostId = `${pageId}_test_post_${Date.now()}`;
  const fakeFromId = `test_user_${Math.floor(Math.random() * 1e9)}`;

  const payload = {
    object: "page",
    entry: [
      {
        id: pageId,
        changes: [
          {
            field: "feed",
            value: {
              item: "comment",
              verb: "add",
              comment_id: fakeCommentId,
              post_id: fakePostId,
              message: commentText,
              from: { id: fakeFromId, name: "Test User" },
            },
          },
        ],
      },
    ],
  };

  const rawBody = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  console.log(`নকল কমেন্ট ইভেন্ট পাঠানো হচ্ছে: ${webhookUrl}`);

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
      body: rawBody,
    });
  } catch (err) {
    console.error("রিকোয়েস্ট পাঠানো ব্যর্থ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`HTTP status: ${response.status}`);
  if (response.status === 200) {
    console.log("ঠিক আছে — webhook রুট ইভেন্টটা queue তে বসিয়েছে। worker এর লগে [messenger-comment] প্রিফিক্সের লাইন দেখুন।");
  } else if (response.status === 401) {
    console.error("signature মেলেনি — MESSENGER_APP_SECRET ভুল, বা .env.local এ অন্য App এর secret বসানো আছে।");
  } else {
    console.error("অপ্রত্যাশিত status — worker/web এর লগ চেক করুন।");
  }
}

main();
