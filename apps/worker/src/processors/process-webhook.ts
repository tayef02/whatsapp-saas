import { getSupabase } from "../lib/supabase";

type EvolutionWebhookBody = {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
};

function normalizeEvent(event: string | undefined): string {
  return (event ?? "").toLowerCase().replace(/_/g, ".");
}

// Evolution থেকে আসা raw ইভেন্ট প্রসেস করে DB আপডেট করে।
// এই মডিউলে শুধু QR কোড আর কানেকশন স্ট্যাটাস — বাকি ইভেন্ট (মেসেজ, রিপ্লাই) পরের মডিউলে হ্যান্ডল হবে।
export async function processWebhookEvent(body: EvolutionWebhookBody) {
  const event = normalizeEvent(body.event);
  const instanceName = body.instance;
  const data = body.data ?? {};

  if (!instanceName) {
    console.warn("[webhook] instance নাম ছাড়া ইভেন্ট এসেছে, স্কিপ করা হলো", body);
    return;
  }

  if (event === "qrcode.updated") {
    const qrCodeBase64 =
      (data.qrcode as { base64?: string } | undefined)?.base64 ?? (data.base64 as string | undefined) ?? null;

    await getSupabase()
      .from("whatsapp_numbers")
      .update({ qr_code: qrCodeBase64, status: "connecting" })
      .eq("instance_name", instanceName);
    return;
  }

  if (event === "connection.update") {
    const state = data.state as string | undefined;
    const status = state === "open" ? "online" : state === "connecting" ? "connecting" : "offline";

    const ownerJid = (data.wuid as string | undefined) ?? (data.ownerJid as string | undefined);
    const phoneNumber = ownerJid ? ownerJid.replace(/@.*/, "") : undefined;

    await getSupabase()
      .from("whatsapp_numbers")
      .update({
        status,
        qr_code: status === "online" ? null : undefined,
        connected_at: status === "online" ? new Date().toISOString() : undefined,
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      })
      .eq("instance_name", instanceName);
    return;
  }

  // অন্য ইভেন্ট (মেসেজ, রিপ্লাই ইত্যাদি) — পরের মডিউলে হ্যান্ডলার যোগ হবে
}
