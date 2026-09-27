import { getSupabase } from "../lib/supabase";
import { getProviderForNumber } from "../lib/provider-for-number";
import type { DownloadGroupMediaJobData } from "@whatsapp-saas/core/groups/types";

const GROUP_MEDIA_BUCKET = "group-media";

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

// মিডিয়া মেসেজ ধরা পড়লে এই job বসে — Evolution এর getBase64FromMediaMessage দিয়ে
// ডিক্রিপ্ট করা ফাইল আনা হয়, storage এ সেভ হয়, group_messages.media_url আপডেট হয়
export async function processDownloadGroupMedia(data: DownloadGroupMediaJobData) {
  const providerInfo = await getProviderForNumber(data.whatsappNumberId);
  if (!providerInfo) {
    console.error(`[group-media] no provider found for number=${data.whatsappNumberId}`);
    return;
  }

  let media;
  try {
    media = await providerInfo.provider.getMediaBase64(providerInfo.instanceName, data.messageId);
  } catch (err) {
    console.error(`[group-media] failed to fetch media for message=${data.messageId}:`, err instanceof Error ? err.message : err);
    return;
  }

  if (!media?.base64) {
    console.error(`[group-media] empty base64 response for message=${data.messageId}`);
    return;
  }

  const supabase = getSupabase();
  const extFromName = media.fileName?.includes(".") ? media.fileName.split(".").pop() : undefined;
  const ext = EXT_BY_MIME[media.mimetype] ?? extFromName ?? "bin";
  const path = `${data.workspaceId}/${data.groupId}/${data.messageId}.${ext}`;
  const buffer = Buffer.from(media.base64, "base64");

  const { error: uploadError } = await supabase.storage.from(GROUP_MEDIA_BUCKET).upload(path, buffer, {
    contentType: media.mimetype,
    upsert: true,
  });

  if (uploadError) {
    console.error(`[group-media] upload failed for message=${data.messageId}:`, uploadError.message);
    return;
  }

  await supabase.from("group_messages").update({ media_url: path }).eq("id", data.groupMessageRowId);
  console.log(`[group-media] saved media for message=${data.messageId} at ${path}`);
}
