import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import type { DownloadInboxMediaJobData } from "@whatsapp-saas/core/chatbot/types";

// process-group-media.ts এর ঠিক একই প্যাটার্ন — শুধু ১:১ ইনবক্সের জন্য (conversation_messages/
// inbox-media bucket টার্গেট করে, group_messages/group-media এর বদলে)
const INBOX_MEDIA_BUCKET = "inbox-media";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

// মিডিয়া মেসেজ ধরা পড়লে এই job বসে — Evolution এর getBase64FromMediaMessage দিয়ে ডিক্রিপ্ট
// করা ফাইল আনা হয়, storage এ সেভ হয়, conversation_messages.media_path আপডেট হয়। ব্যর্থ হলে
// শুধু লগ করে চুপচাপ রিটার্ন করে (throw না) — মূল মেসেজ (টেক্সট/ক্যাপশন) ততক্ষণে আগেই সেভ হয়ে
// গেছে, তাই মিডিয়া ডাউনলোড ব্যর্থ হলেও পুরো মেসেজ হারায় না, শুধু থাম্বনেইল আসে না
export async function processDownloadInboxMedia(data: DownloadInboxMediaJobData) {
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[inbox-media] no provider found for number=${data.whatsappNumberId}`);
    return;
  }

  let media;
  try {
    media = await providerInfo.provider.getMediaBase64(providerInfo.instanceName, data.messageId);
  } catch (err) {
    console.error(`[inbox-media] failed to fetch media for message=${data.messageId}:`, err instanceof Error ? err.message : err);
    return;
  }

  if (!media?.base64) {
    console.error(`[inbox-media] empty base64 response for message=${data.messageId}`);
    return;
  }

  const supabase = getSupabase();
  const extFromName = media.fileName?.includes(".") ? media.fileName.split(".").pop() : undefined;
  const ext = EXT_BY_MIME[media.mimetype] ?? extFromName ?? "bin";
  const path = `${data.workspaceId}/${data.conversationId}/${data.messageId}.${ext}`;
  const buffer = Buffer.from(media.base64, "base64");

  const { error: uploadError } = await supabase.storage.from(INBOX_MEDIA_BUCKET).upload(path, buffer, {
    contentType: media.mimetype,
    upsert: true,
  });

  if (uploadError) {
    console.error(`[inbox-media] upload failed for message=${data.messageId}:`, uploadError.message);
    return;
  }

  const { error: updateError } = await supabase
    .from("conversation_messages")
    .update({ media_path: path })
    .eq("id", data.conversationMessageId);

  if (updateError) {
    console.error(`[inbox-media] failed to save media_path for conversation_messages id=${data.conversationMessageId}:`, updateError.message);
    return;
  }

  console.log(`[inbox-media] saved media for message=${data.messageId} at ${path}`);
}
