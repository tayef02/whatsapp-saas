"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@whatsapp-saas/core/providers/evolution";
import { getWorkspacePlanInfo, getNumberCount } from "@/lib/subscriptions/limits";

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

  const { plan } = await getWorkspacePlanInfo(supabase, membership.workspace_id);
  if (plan) {
    const current = await getNumberCount(supabase, membership.workspace_id);
    if (current >= plan.max_numbers) {
      return { error: `আপনার প্ল্যানে সর্বোচ্চ ${plan.max_numbers}টা নাম্বার কানেক্ট করা যায় — প্ল্যান আপগ্রেড করুন` };
    }
  }

  // dedup-check: creation এর সময় আসল ফোন নাম্বার এখনো জানা যায় না (QR স্ক্যান করার পরই Evolution
  // থেকে আসে), তাই ফোন নাম্বার দিয়ে ডুপ্লিকেট চেক সম্ভব না। এর বদলে একই নামে ইতিমধ্যে
  // কানেক্টেড/কানেক্ট-হচ্ছে এমন নাম্বার আছে কিনা দেখা হচ্ছে — বারবার ক্লিকে একই নামে একাধিক
  // "connecting" সারি তৈরি হওয়া (ডুপ্লিকেট রো সমস্যার মূল কারণ) এটা ঠেকায়
  const { data: existingNumber } = await supabase
    .from("whatsapp_numbers")
    .select("id")
    .eq("workspace_id", membership.workspace_id)
    .in("status", ["connecting", "online"])
    .ilike("display_name", displayName)
    .maybeSingle();

  if (existingNumber) {
    return { error: `"${displayName}" নামে একটা নাম্বার আগে থেকেই আছে বা কানেক্ট হচ্ছে — সেটাই ব্যবহার করুন, অথবা নতুন নাম্বারের জন্য অন্য নাম দিন` };
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

  // instance-লেভেল webhook — APP_URL সেট না থাকলে (যেমন কোনো পুরনো .env) undefined যাবে,
  // তখন Evolution তার নিজের গ্লোবাল webhook config ব্যবহার করবে
  const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/evolution` : undefined;

  let qrCodeBase64: string | null;
  try {
    const result = await provider.createInstance(instanceName, webhookUrl);
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

// "ডিসকানেক্ট" বাটন — Evolution এ logout কল করে, তারপর স্ট্যাটাস offline করে দেয়
// (connection.update webhook একটু পরে একই আপডেট আবার পাঠাবে, সমস্যা নেই — idempotent)
export async function disconnectNumber(numberId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, instance_name, evolution_server_id")
    .eq("id", numberId)
    .maybeSingle();

  if (!number) {
    return { error: "নাম্বার পাওয়া যায়নি" };
  }

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("evolution_servers")
    .select("api_url, api_key")
    .eq("id", number.evolution_server_id)
    .maybeSingle();

  if (!server) {
    return { error: "সার্ভার তথ্য পাওয়া যায়নি" };
  }

  const provider = new EvolutionProvider({ apiUrl: server.api_url, apiKey: server.api_key });

  try {
    await provider.disconnect(number.instance_name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ডিসকানেক্ট করা যায়নি" };
  }

  await admin.from("whatsapp_numbers").update({ status: "offline" }).eq("id", numberId);

  return { error: null };
}

// অফলাইন/ব্যান হওয়া নাম্বার মুছে ফেলা — কানেক্টেড (online) নাম্বার ভুলে মুছে যাওয়া ঠেকাতে
// সার্ভার-সাইডেও গার্ড আছে (UI বাটন এমনিতেই শুধু অফলাইন কার্ডে দেখাবে)
export async function deleteNumber(numberId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("id, status")
    .eq("id", numberId)
    .maybeSingle();

  if (!number) {
    return { error: "নাম্বার পাওয়া যায়নি" };
  }
  if (number.status === "online") {
    return { error: "কানেক্টেড নাম্বার মুছে ফেলা যাবে না — আগে ডিসকানেক্ট করুন" };
  }

  const { error } = await supabase.from("whatsapp_numbers").delete().eq("id", numberId);

  if (error) {
    if (error.code === "23503") {
      return { error: "এই নাম্বারে ক্যাম্পেইন হিস্ট্রি আছে বলে মুছা যাচ্ছে না" };
    }
    return { error: error.message };
  }

  return { error: null };
}

// নাম্বার কার্ডে "বট অন/অফ" টগল — whatsapp_numbers.bot_enabled কলাম আপডেট করে (migration 0037)।
// আগে chatbot_configs নামের আলাদা টেবিলে লিখত, কিন্তু সেই টেবিল migration 0021 এ ড্রপ হয়ে
// গিয়েছিল — ফলে টগলটা প্রোডাকশনে আসলে কাজই করছিল না। worker এর handleIncomingMessage এখন
// সরাসরি এই কলাম চেক করে (process-webhook.ts)।
export async function toggleBot(numberId: string, botEnabled: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "লগইন করা নেই" };
  }

  // এই সিলেক্ট RLS (numbers_select_member) এর মধ্য দিয়েই যায় — নাম্বারটা এই ইউজারের
  // workspace এর না হলে এখানেই "পাওয়া যায়নি" ফেরত যাবে, আপডেট পর্যন্ত যাবে না
  const { data: number } = await supabase.from("whatsapp_numbers").select("id").eq("id", numberId).maybeSingle();

  if (!number) {
    return { error: "নাম্বার পাওয়া যায়নি" };
  }

  const { error } = await supabase.from("whatsapp_numbers").update({ bot_enabled: botEnabled }).eq("id", numberId);

  if (error) {
    console.error(`[toggleBot] number=${numberId} bot_enabled আপডেট ব্যর্থ: ${error.message}`);
    return { error: "বট টগল সেভ করা যায়নি, একটু পর আবার চেষ্টা করুন" };
  }

  return { error: null };
}
