# গ্রুপ মিডিয়া ফাইল পরিষ্কার করা (ম্যানুয়াল ধাপ)

`group_messages` টেবিলের রো মুছলেও Supabase Storage-এ সেভ থাকা আসল ছবি/ফাইল মুছে যায় না —
ডাটাবেসের রো আর স্টোরেজ ফাইল আলাদা জিনিস। `02_delete.sql` চালানোর পর নিচের ধাপে ম্যানুয়ালি
এই ফাইলগুলো মুছতে হবে।

## কোন bucket, কোন path

- **Bucket**: `group-media` (প্রাইভেট বাকেট, migration `0033_group_media_bucket.sql`)
- **Path প্যাটার্ন**: `{workspace_id}/{group_id}/{message_id}.{ext}`
  (কোড: `apps/worker/src/processors/process-group-media.ts:43`)

`group_messages` এর সব রো মুছে ফেলা মানে এই cleanup-এর পর আর কোনো রো *কোনো* ফাইলকেই
রেফারেন্স করবে না — তাই পুরো `group-media` বাকেট খালি করে দেওয়া নিরাপদ (অন্য কোনো টেবিল/ফিচার
এই বাকেট ব্যবহার করে না)।

⚠️ **এই বাকেটের বাইরে কিছু ছোঁবেন না** — `template-media` (টেমপ্লেটের ছবি/PDF, রাখতে হবে) আর
`contact-imports` (CSV আপলোড, রাখতে হবে) সম্পূর্ণ আলাদা বাকেট, ভুলেও এগুলোয় হাত দেবেন না।

## ধাপে ধাপে (Supabase Dashboard দিয়ে, কোনো কোড লাগবে না)

1. Supabase Dashboard → বাঁ পাশের মেনু থেকে **Storage** এ যান।
2. **group-media** বাকেটে ক্লিক করুন।
3. বাকেটের ভেতরে প্রতিটা top-level ফোল্ডার আসলে একটা `workspace_id` (একাধিক থাকতে পারে যদি
   একাধিক workspace টেস্ট করে থাকে)। প্রতিটা ফোল্ডার সিলেক্ট করে **Delete** চাপুন — অথবা
   একবারে সব ফোল্ডার সিলেক্ট করে (চেকবক্স/Select all) একসাথে ডিলিট করুন।
4. ফোল্ডার অনেক গভীরে নেস্টেড থাকায় (`workspace_id/group_id/file`) একটা একটা করে ফাইল বাছতে
   না চাইলে, প্রতিটা workspace ফোল্ডার একবারে সিলেক্ট করে ডিলিট করাই সহজ — ভেতরের সব group
   ফোল্ডার আর ফাইল নিজে থেকেই চলে যাবে।
5. ডিলিট করার পর বাকেট রিফ্রেশ করে নিশ্চিত হন এটা খালি দেখাচ্ছে।

## বিকল্প (ঐচ্ছিক, দ্রুত হয় যদি ফোল্ডার/ফাইল অনেক বেশি হয়)

Dashboard UI দিয়ে অনেক নেস্টেড ফোল্ডার এক এক করে মোছা ধীরগতির মনে হলে, নিচের ছোট Node.js
স্ক্রিপ্টটা (আমি চালাইনি, আপনি নিজে আপনার মেশিনে/সার্ভারে রান করবেন) পুরো বাকেট recursively
খালি করে দেয়:

```js
// clean-group-media.js — নিজে চালান: node clean-group-media.js
// দরকার: SUPABASE_URL আর SUPABASE_SERVICE_ROLE_KEY env var (worker/.env এ যা আছে সেটাই)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "group-media";

async function listAllPaths(prefix = "") {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  let paths = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // ফোল্ডার — ভেতরে recurse করা
      paths = paths.concat(await listAllPaths(fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

const allPaths = await listAllPaths();
console.log(`মোট ${allPaths.length}টা ফাইল পাওয়া গেছে`);
if (allPaths.length > 0) {
  const { error } = await supabase.storage.from(BUCKET).remove(allPaths);
  if (error) throw error;
  console.log("সব মুছে ফেলা হয়েছে");
}
```

এই স্ক্রিপ্টটাও আমি নিজে চালাইনি — আপনি চাইলে ব্যবহার করবেন, অথবা শুধু Dashboard UI দিয়ে
ম্যানুয়ালি করলেই যথেষ্ট।
