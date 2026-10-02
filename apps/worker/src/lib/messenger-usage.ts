import type { SupabaseClient } from "@supabase/supabase-js";

// Messenger এর একটা সফলভাবে পাঠানো মেসেজ প্ল্যানের মাসিক ব্যবহারে গোনে (workspaces.
// messenger_messages_used_this_cycle, migration 0053) — শুধু গণনা, কোটা পেরোলেও Messenger রিপ্লাই
// কখনো আটকায় না। WhatsApp এর messages_used_this_cycle আলাদা কলাম, এখানে ছোঁয়া হয় না।
//
// প্রোভাইডার সফল হওয়ার ঠিক পরে ডাকতে হবে। গণনা ব্যর্থ হলেও caller কখনো throw পাবে না — তাহলে
// BullMQ retry করে একই মেসেজ আবার পাঠিয়ে ফেলত (আসল মেসেজ ইতিমধ্যে চলে গেছে)। এরর শুধু লগ হয়,
// মেসেজের লেখা/psid কখনো না।
export async function countMessengerMessageSent(supabase: SupabaseClient, workspaceId: string | null | undefined, source: string) {
  if (!workspaceId) {
    console.error(`[messenger-usage] workspace অজানা, গণনা বাদ গেছে source=${source}`);
    return;
  }

  const { error } = await supabase.rpc("increment_messenger_messages_used", { p_workspace_id: workspaceId, p_count: 1 });
  if (error) console.error(`[messenger-usage] গণনা ব্যর্থ source=${source} workspace=${workspaceId}: ${error.message}`);
}
