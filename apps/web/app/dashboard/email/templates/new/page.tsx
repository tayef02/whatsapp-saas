import { createClient } from "@/lib/supabase/server";
import NewEmailTemplateEditor from "./NewEmailTemplateEditor";
import { loadEditorData } from "../editor-data";

export default async function NewEmailTemplatePage() {
  const supabase = await createClient();
  const data = await loadEditorData(supabase);
  return <NewEmailTemplateEditor {...data} />;
}
