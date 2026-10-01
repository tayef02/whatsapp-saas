import { getSupabase } from "./supabase";

// channel বাধ্যতামূলক (optional না) — যাতে কম্পাইলার-ই নিশ্চিত করে প্রতিটা কল-সাইট চ্যানেল
// নিয়ে সচেতনভাবে সিদ্ধান্ত নিয়েছে, ভুলে বাদ না পড়ে। null মানে অ্যাকাউন্ট-লেভেল/চ্যানেল-নিরপেক্ষ
// (যেমন প্ল্যান মেয়াদ শেষের অ্যালার্ট) — টপবারের বেল channel-সচেতন হলেও এগুলো সবসময় দেখাবে।
export async function createNotification(
  workspaceId: string,
  type: string,
  title: string,
  channel: "whatsapp" | "messenger" | null,
  body?: string
) {
  await getSupabase().from("notifications").insert({ workspace_id: workspaceId, type, title, channel, body });
}
