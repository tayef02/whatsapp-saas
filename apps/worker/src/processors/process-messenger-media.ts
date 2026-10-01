import { getSupabase } from "../lib/supabase";
import type { DownloadMessengerMediaJobData } from "@whatsapp-saas/core/messenger/types";

// WhatsApp এর process-inbox-media.ts এর ঠিক একই প্যাটার্ন — একই "inbox-media" bucket reuse হয়
// (নতুন bucket/migration লাগেনি), শুধু "messenger/" পাথ প্রিফিক্স দিয়ে WhatsApp এর পাথ থেকে আলাদা
// রাখা হয়েছে। পার্থক্য: WhatsApp এ Evolution এর নিজস্ব getMediaBase64 (messageId দিয়ে আবার
// ফেচ) ব্যবহার হয়, Messenger এ webhook payload এর Graph CDN URL সরাসরি fetch() করা হয় —
// সেই URL এর মেয়াদ ছোট বলে এই job যত দ্রুত সম্ভব প্রসেসিং এর কথা (BullMQ queue সাধারণত
// সেকেন্ডের মধ্যেই প্রসেস করে)
const INBOX_MEDIA_BUCKET = "inbox-media";

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

// ডাউনলোড ব্যর্থ হলে শুধু লগ করে চুপচাপ রিটার্ন করে (throw না) — মূল মেসেজ (প্লেসহোল্ডার
// টেক্সট) ততক্ষণে আগেই সেভ হয়ে গেছে, তাই এটা ব্যর্থ হলেও পুরো মেসেজ হারায় না, শুধু থাম্বনেইল আসে না
export async function processDownloadMessengerMedia(data: DownloadMessengerMediaJobData) {
  let res: Response;
  try {
    res = await fetch(data.mediaUrl, { signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    console.error(`[messenger-media] fetch ব্যর্থ message=${data.messengerMessageId}:`, err instanceof Error ? err.message : err);
    return;
  }

  if (!res.ok) {
    console.error(`[messenger-media] fetch failed (HTTP ${res.status}) message=${data.messengerMessageId} — সম্ভবত URL এর মেয়াদ শেষ হয়ে গেছে`);
    return;
  }

  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const urlExt = data.mediaUrl.split("?")[0].split(".").pop();
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? (urlExt && urlExt.length <= 4 ? urlExt : "bin");

  const buffer = Buffer.from(await res.arrayBuffer());
  const path = `messenger/${data.workspaceId}/${data.conversationId}/${data.messengerMessageId}.${ext}`;

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage.from(INBOX_MEDIA_BUCKET).upload(path, buffer, {
    contentType: contentType || undefined,
    upsert: true,
  });

  if (uploadError) {
    console.error(`[messenger-media] upload failed message=${data.messengerMessageId}:`, uploadError.message);
    return;
  }

  const { error: updateError } = await supabase.from("messenger_messages").update({ media_path: path }).eq("id", data.messengerMessageId);

  if (updateError) {
    console.error(`[messenger-media] failed to save media_path message=${data.messengerMessageId}:`, updateError.message);
    return;
  }

  console.log(`[messenger-media] saved media for message=${data.messengerMessageId} at ${path}`);
}
