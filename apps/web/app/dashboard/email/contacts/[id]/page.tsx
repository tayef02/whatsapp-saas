import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditEmailContactForm from "./EditEmailContactForm";

export default async function EditEmailContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("email_contacts")
    .select("id, email, name, tags, custom_fields, consent_source, consent_import_id")
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  return (
    <EditEmailContactForm
      id={contact.id}
      email={contact.email}
      name={contact.name ?? ""}
      tags={(contact.tags as string[]).join(", ")}
      customFields={contact.custom_fields as Record<string, string>}
      consentSource={contact.consent_source}
      consentImportId={contact.consent_import_id}
    />
  );
}
