import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmailTemplateForm from "../EmailTemplateForm";
import { loadEditorData } from "../editor-data";

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("id, name, category, subject, preheader, body_html, body_text")
    .eq("id", id)
    .maybeSingle();

  if (!template) notFound();

  const data = await loadEditorData(supabase);
  return (
    <EmailTemplateForm
      mode="edit"
      templateId={template.id}
      initial={{
        name: template.name,
        category: template.category ?? "",
        subject: template.subject,
        preheader: template.preheader ?? "",
        bodyHtml: template.body_html,
        bodyText: template.body_text,
      }}
      {...data}
    />
  );
}
