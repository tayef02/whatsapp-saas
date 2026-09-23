"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@whatsapp-saas/core/providers/evolution";

// নতুন WhatsApp নাম্বার কানেক্ট শুরু করে:
// ১. ইউজারের workspace বের করা (RLS-স্কোপড ক্লায়েন্ট দিয়ে, তাই অন্য কারো workspace পাওয়া যাবে না)
// ২. সবচেয়ে কম-লোড Evolution সার্ভার বাছাই (admin ক্লায়েন্ট দিয়ে, কারণ evolution_servers এ RLS এ কারো GRANT নেই)
// ৩. Evolution এ instance বানিয়ে QR কোড আনা
// ৪. whatsapp_numbers এ row বসানো (admin ক্লায়েন্ট দিয়ে, workspace membership আগেই ভেরিফাই করা হয়েছে)
export async function createNumber(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) {
    return { error: "নাম্বারের একটা নাম দিন (যেমন: সেলস নাম্বার)" };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: "workspace পাওয়া যায়নি" };
  }

  const admin = createAdminClient();

  // pick_least_loaded_server() একটা single row (SETOF না) রিটার্ন করে,
  // তাই PostgREST এটাকে সরাসরি object হিসেবে দেয় — .single() লাগবে না
  const { data: server, error: serverError } = await admin.rpc("pick_least_loaded_server");

  if (serverError) {
    return { error: `সার্ভার বাছাই করতে সমস্যা: ${serverError.message}` };
  }
  if (!server) {
    return { error: "কোনো খালি Evolution সার্ভার নেই, অ্যাডমিনকে জানান" };
  }

  const instanceName = `ws_${membership.workspace_id.slice(0, 8)}_${Date.now().toString(36)}`;

  const provider = new EvolutionProvider({
    apiUrl: (server as { api_url: string }).api_url,
    apiKey: (server as { api_key: string }).api_key,
  });

  let qrCodeBase64: string | null;
  try {
    const result = await provider.createInstance(instanceName);
    qrCodeBase64 = result.qrCodeBase64;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Evolution API তে instance বানানো যায়নি" };
  }

  const { data: number, error: insertError } = await admin
    .from("whatsapp_numbers")
    .insert({
      workspace_id: membership.workspace_id,
      evolution_server_id: (server as { id: string }).id,
      instance_name: instanceName,
      display_name: displayName,
      status: "connecting",
      qr_code: qrCodeBase64,
    })
    .select("id")
    .single();

  if (insertError || !number) {
    return { error: insertError?.message ?? "নাম্বার সেভ করা যায়নি" };
  }

  return { error: null, id: number.id as string };
}
