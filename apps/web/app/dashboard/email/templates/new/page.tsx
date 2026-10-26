import { createClient } from "@/lib/supabase/server";
import EmailTemplateForm from "../EmailTemplateForm";
import { loadEditorData } from "../editor-data";

export default async function NewEmailTemplatePage() {
  const supabase = await createClient();
  const data = await loadEditorData(supabase);
  return <EmailTemplateForm mode="create" {...data} />;
}
