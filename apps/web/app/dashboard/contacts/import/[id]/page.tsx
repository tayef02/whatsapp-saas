import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportProgress from "./ImportProgress";

export default async function ImportStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("contact_imports")
    .select("id, status, total_rows, processed_rows, added_count, duplicate_count, invalid_count, error_message")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return <ImportProgress initial={data} />;
}
