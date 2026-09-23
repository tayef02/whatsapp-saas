import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditContactForm from "./EditContactForm";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("contacts")
    .select("id, phone, name, tags, opted_out, custom_fields")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return <EditContactForm contact={data} />;
}
