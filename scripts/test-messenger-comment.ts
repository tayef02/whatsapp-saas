// Messenger কমেন্ট পাইপলাইন ম্যানুয়ালি টেস্ট করার স্ক্রিপ্ট — Meta-র "feed" webhook ইভেন্টের
// ঠিক একই আকারের একটা নকল payload বানিয়ে, আসল MESSENGER_APP_SECRET দিয়ে sign করে,
// /api/webhooks/messenger এ POST করে (ডিফল্টে লোকাল, --url দিয়ে প্রোডাকশনেও)। এটা রুল-ম্যাচিং,
// লগিং, আর queue/worker পাইপলাইন পরীক্ষা করে — কিন্তু comment_id/post_id নকল হওয়ায় worker
// যখন আসল Meta API কে রিপ্লাই পাঠানোর চেষ্টা করবে, সেটা ব্যর্থ হবে (এটা প্রত্যাশিত, নিচে docs এ ব্যাখ্যা আছে)।
//
// ব্যবহার:
//   npx tsx scripts/test-messenger-comment.ts <page_id> "<কমেন্টের লেখা>" [--url <target_url>] [--env-path <path>]
//
// নোট: ফ্ল্যাগটার নাম ইচ্ছাকৃতভাবে "--env-path", "--env-file" না — tsx নিজেই "--env-file"
// ফ্ল্যাগটা node এর built-in env-loader হিসেবে ধরে নেয় আর script এর কাছে পৌঁছানোর আগেই
// নিজে প্রসেস করে ফেলে (ফাইল না পেলে script-ই চালু হয় না) — তাই কনফ্লিক্ট এড়াতে আলাদা নাম।
//
// secret, payload, আর টার্গেট URL এর কোনো কোয়েরি-স্ট্রিং কখনো প্রিন্ট হয় না — শুধু HTTP status
// আর সংক্ষিপ্ত ফল। বিস্তারিত: docs/messenger-plan.md এর "M3 — টেস্ট স্ক্রিপ্ট দিয়ে যাচাই" সেকশন দেখুন।

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_WEBHOOK_URL = "http://localhost:3000/api/webhooks/messenger";
const DEFAULT_ENV_PATH = path.resolve(__dirname, "..", "apps/web/.env.local");
const WEBHOOK_PATH = "/api/webhooks/messenger";

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

// --url শুধু origin (যেমন https://wa.srv1980546.hstgr.cloud) দিলেও চলবে, webhook পাথ নিজে যুক্ত হয়ে যায়।
// URL অবজেক্ট দিয়ে pathname-এ জোড়া হয় (সাধারণ স্ট্রিং concat না) যাতে কখনো যদি query/hash থাকে তাতে গন্ডগোল না হয়
function resolveWebhookUrl(input: string | undefined): string {
  const raw = (input || DEFAULT_WEBHOOK_URL).trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw; // অবৈধ URL — fetch() নিজেই স্পষ্ট এরর দেখাবে
  }
  if (!u.pathname.includes(WEBHOOK_PATH)) {
    u.pathname = u.pathname.replace(/\/+$/, "") + WEBHOOK_PATH;
  }
  return u.toString();
}

// লগে কখনো query string দেখানো হয় না (ভুলেও কেউ --url এ টোকেন/সিক্রেট জুড়ে দিলে সেটা চাপা থাকবে)
function urlWithoutQueryForLog(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return "(অবৈধ URL)";
  }
}

function printUsageAndExit(): never {
  console.error(
    'ব্যবহার: npx tsx scripts/test-messenger-comment.ts <page_id> "<কমেন্টের লেখা>" [--url <target_url>] [--env-path <path>]'
  );
  console.error("  page_id      — কানেক্টেড Messenger পেজের আসল Facebook page_id (messenger_pages টেবিলে দেখুন)");
  console.error('  কমেন্টের লেখা — কোট দিয়ে ঘিরে দিন, যেমন "দাম কত?"');
  console.error("  --url        — ডিফল্ট: " + DEFAULT_WEBHOOK_URL + " (শুধু origin দিলেও চলবে, path নিজে যুক্ত হয়)");
  console.error("  --env-path   — MESSENGER_APP_SECRET কোথা থেকে পড়বে, ডিফল্ট: apps/web/.env.local");
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let urlArg: string | undefined;
  let envPathArg: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") {
      urlArg = argv[++i];
    } else if (arg === "--env-path") {
      envPathArg = argv[++i];
    } else {
      positional.push(arg);
    }
  }

  return { pageId: positional[0], commentText: positional[1], urlArg, envPathArg };
}

async function main() {
  const { pageId, commentText, urlArg, envPathArg } = parseArgs(process.argv.slice(2));
  if (!pageId || !commentText) printUsageAndExit();

  const envPath = envPathArg ? path.resolve(process.cwd(), envPathArg) : DEFAULT_ENV_PATH;
  const env = parseEnvFile(envPath);
  const appSecret = env.MESSENGER_APP_SECRET || process.env.MESSENGER_APP_SECRET;
  if (!appSecret) {
    console.error(`MESSENGER_APP_SECRET পাওয়া যায়নি (চেক করা হয়েছে: ${envPath})`);
    process.exit(1);
  }

  const webhookUrl = resolveWebhookUrl(urlArg);

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

  console.log(`নকল কমেন্ট ইভেন্ট পাঠানো হচ্ছে: ${urlWithoutQueryForLog(webhookUrl)}`);

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
    console.error("signature মেলেনি — MESSENGER_APP_SECRET ভুল, বা env ফাইলে অন্য App এর secret বসানো আছে।");
  } else {
    console.error("অপ্রত্যাশিত status — worker/web এর লগ চেক করুন।");
  }
}

main();
