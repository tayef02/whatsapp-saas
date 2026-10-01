"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetaMessengerProvider } from "@whatsapp-saas/core/providers/messenger";

const PAGES_COOKIE = "messenger_oauth_pages";

// callback এ পাওয়া পেজ তালিকা (token সহ) থেকে বাছাই করা একটা পেজ কানেক্ট করে — webhook
// সাবস্ক্রাইব, token Vault এ সেভ, messenger_pages রো বানানো। কুকি এখানেই single-use হিসেবে
// মুছে ফেলা হয় (সফল হোক বা ব্যর্থ)
export async function connectPage(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
  if (!membership) redirect("/dashboard/messenger?error=no_workspace");

  const cookieStore = await cookies();
  const raw = cookieStore.get(PAGES_COOKIE)?.value;
  cookieStore.delete(PAGES_COOKIE);

  if (!pageId || !raw) redirect("/dashboard/messenger?error=expired");

  let pages: Array<{ pageId: string; pageName: string; pageAccessToken: string }>;
  try {
    pages = JSON.parse(raw);
  } catch {
    redirect("/dashboard/messenger?error=expired");
  }

  const page = pages.find((p) => p.pageId === pageId);
  if (!page) redirect("/dashboard/messenger?error=invalid_page");

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) redirect("/dashboard/messenger?error=not_configured");

  const provider = new MetaMessengerProvider({ appId, appSecret });

  try {
    await provider.subscribePageWebhook(page.pageId, page.pageAccessToken);
  } catch (err) {
    console.error(`[messenger connect] webhook subscribe ব্যর্থ (page=${page.pageId}):`, err instanceof Error ? err.message : err);
    redirect("/dashboard/messenger?error=subscribe_failed");
  }

  // messenger_pages এ table-level GRANT + is_workspace_member RLS policy আগে থেকেই আছে
  // (migration 0040) — এই insert RLS-স্কোপড ক্লায়েন্ট দিয়েই হচ্ছে, admin ক্লায়েন্ট লাগছে না
  const { data: row, error: insertError } = await supabase
    .from("messenger_pages")
    .upsert(
      {
        workspace_id: membership.workspace_id,
        page_id: page.pageId,
        page_name: page.pageName,
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,page_id" }
    )
    .select("id")
    .maybeSingle();

  if (insertError || !row) {
    console.error("[messenger connect] messenger_pages upsert ব্যর্থ:", insertError?.message);
    redirect("/dashboard/messenger?error=save_failed");
  }

  const { error: tokenError } = await supabase.rpc("set_messenger_page_token", { p_page_id: row.id, p_token: page.pageAccessToken });
  if (tokenError) {
    console.error("[messenger connect] token Vault সেভ ব্যর্থ:", tokenError.message);
    redirect("/dashboard/messenger?error=save_failed");
  }

  redirect("/dashboard/messenger");
}

// ডিসকানেক্ট — token দিয়ে best-effort webhook unsubscribe, তারপর সবসময় নিজেদের token/status
// পরিষ্কার করে (unsubscribe ব্যর্থ হলেও আমাদের দিক থেকে disconnected থাকাই নিরাপদ)
export async function disconnectPage(pageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  // RLS-স্কোপড সিলেক্ট — এই পেজ সত্যিই কলারের workspace এর কিনা এখানেই যাচাই হয়ে যায়
  const { data: page } = await supabase.from("messenger_pages").select("id, page_id").eq("id", pageId).maybeSingle();
  if (!page) return { error: "পেজ পাওয়া যায়নি" };

  const admin = createAdminClient();
  const { data: token } = await admin.rpc("get_messenger_page_token", { p_page_id: pageId });

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;

  if (token && appId && appSecret) {
    try {
      const provider = new MetaMessengerProvider({ appId, appSecret });
      await provider.unsubscribePageWebhook(page.page_id, token);
    } catch (err) {
      console.error(`[messenger disconnect] webhook unsubscribe ব্যর্থ (page=${page.page_id}):`, err instanceof Error ? err.message : err);
    }
  }

  const { error } = await supabase.rpc("clear_messenger_page_token", { p_page_id: pageId });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/messenger");
  return { error: null };
}

// Phase M3: webhook এ "feed" field যোগ হয়েছে (কমেন্ট ইভেন্ট পেতে) — আগে কানেক্ট হওয়া পেজ
// পুরনো subscribed_fields দিয়েই subscribed আছে, আবার subscribePageWebhook() কল করলে Meta
// বিদ্যমান সাবস্ক্রিপশন নতুন fields দিয়ে replace করে দেয় (WhatsApp Groups পেজের "Webhook
// ইভেন্ট রিফ্রেশ করুন" বাটনের ঠিক একই নিয়ম)
export async function refreshMessengerWebhook(pageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  const { data: page } = await supabase.from("messenger_pages").select("id, page_id").eq("id", pageId).maybeSingle();
  if (!page) return { error: "পেজ পাওয়া যায়নি" };

  const admin = createAdminClient();
  const { data: token } = await admin.rpc("get_messenger_page_token", { p_page_id: pageId });
  if (!token) return { error: "টোকেন পাওয়া যায়নি — পেজটা আবার কানেক্ট করুন" };

  const appId = process.env.MESSENGER_APP_ID;
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appId || !appSecret) return { error: "সার্ভার সেটআপ অসম্পূর্ণ" };

  try {
    const provider = new MetaMessengerProvider({ appId, appSecret });
    await provider.subscribePageWebhook(page.page_id, token);
  } catch (err) {
    console.error(`[messenger webhook refresh] ব্যর্থ (page=${page.page_id}):`, err instanceof Error ? err.message : err);
    return { error: "ওয়েবহুক রিফ্রেশ করা যায়নি, একটু পর আবার চেষ্টা করুন" };
  }

  return { error: null };
}

// পেজ কার্ডে "বট অন/অফ" টগল — messenger_pages.bot_enabled কলাম আপডেট করে (migration 0040 এ
// ডিফল্ট true দিয়ে যোগ করা হয়েছিল)। WhatsApp numbers/actions.ts এর toggleBot এর ঠিক একই প্যাটার্ন —
// worker এর process-messenger-webhook.ts সরাসরি এই কলাম চেক করে
export async function toggleMessengerPageBot(pageId: string, botEnabled: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "লগইন করা নেই" };

  // এই সিলেক্ট RLS এর মধ্য দিয়েই যায় — পেজটা এই ইউজারের workspace এর না হলে এখানেই
  // "পাওয়া যায়নি" ফেরত যাবে, আপডেট পর্যন্ত যাবে না
  const { data: page } = await supabase.from("messenger_pages").select("id").eq("id", pageId).maybeSingle();
  if (!page) return { error: "পেজ পাওয়া যায়নি" };

  const { error } = await supabase.from("messenger_pages").update({ bot_enabled: botEnabled }).eq("id", pageId);

  if (error) {
    console.error(`[toggleMessengerPageBot] page=${pageId} bot_enabled আপডেট ব্যর্থ: ${error.message}`);
    return { error: "বট টগল সেভ করা যায়নি, একটু পর আবার চেষ্টা করুন" };
  }

  revalidatePath("/dashboard/messenger");
  return { error: null };
}
