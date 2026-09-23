import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NumberStatus from "./NumberStatus";

export default async function NumberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("whatsapp_numbers")
    .select("id, status, qr_code, phone_number, display_name")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return <NumberStatus initial={data} />;
}
