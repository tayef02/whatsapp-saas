import type { NormalizedContact } from "./normalize-batch";

// supabase client এর পুরো টাইপ এখানে দরকার নেই, শুধু যেটুকু ব্যবহার হয়
interface MinimalSupabaseClient {
  from(table: string): {
    upsert(
      rows: unknown[],
      options: { onConflict: string; ignoreDuplicates: boolean }
    ): {
      select(
        columns: string
      ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
}

export interface UpsertProgress {
  processedRows: number;
  addedCount: number;
  duplicateCount: number;
}

// ৫০,০০০+ কন্টাক্টেও যেন সমস্যা না হয়, তাই ১০০০ করে ব্যাচে insert হয় (on conflict do nothing)।
// onProgress দিয়ে worker প্রতি ব্যাচের পর contact_imports টেবিলে প্রগ্রেস আপডেট করতে পারে।
export async function upsertContactsBatched(
  supabase: MinimalSupabaseClient,
  workspaceId: string,
  contacts: NormalizedContact[],
  tag: string | null,
  onProgress?: (progress: UpsertProgress) => Promise<void>
): Promise<UpsertProgress> {
  const BATCH_SIZE = 1000;
  let processedRows = 0;
  let addedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE).map((c) => ({
      workspace_id: workspaceId,
      phone: c.phone,
      name: c.name,
      custom_fields: c.custom_fields,
      tags: tag ? [tag] : [],
      source: "import",
    }));

    const { data, error } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "workspace_id,phone", ignoreDuplicates: true })
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    const insertedInBatch = data?.length ?? 0;
    processedRows += batch.length;
    addedCount += insertedInBatch;
    duplicateCount += batch.length - insertedInBatch;

    if (onProgress) {
      await onProgress({ processedRows, addedCount, duplicateCount });
    }
  }

  return { processedRows, addedCount, duplicateCount };
}
