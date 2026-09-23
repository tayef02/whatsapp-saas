import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TemplateForm from "../TemplateForm";
import { getVariableSuggestions } from "../actions";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("templates")
    .select("id, name, category, content, media_url, media_type")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone, custom_fields")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const variableSuggestions = await getVariableSuggestions();

  const sampleContact = contact ?? { name: "রহিম উদ্দিন", phone: "8801712345678", custom_fields: {} };

  return (
    <TemplateForm
      mode="edit"
      templateId={template.id}
      initial={template}
      sampleContact={sampleContact}
      variableSuggestions={variableSuggestions}
    />
  );
}
