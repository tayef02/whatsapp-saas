import { TEMPLATE_MEDIA_BUCKET, TEMPLATE_MEDIA_SIGNED_URL_SECONDS } from "./constants";

interface MinimalStorageClient {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

// templates.media_url এখন storage path রাখে (bucket private), তাই পাঠানোর সময়
// (মডিউল ৫, worker) এই ফাংশন দিয়ে অল্প সময়ের জন্য একটা signed URL বানিয়ে Evolution কে দেওয়া হবে
export async function getSignedTemplateMediaUrl(
  supabase: MinimalStorageClient,
  path: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(TEMPLATE_MEDIA_BUCKET)
    .createSignedUrl(path, TEMPLATE_MEDIA_SIGNED_URL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}
