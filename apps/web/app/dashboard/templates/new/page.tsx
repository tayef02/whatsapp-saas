import { createClient } from "@/lib/supabase/server";
import TemplateForm from "../TemplateForm";
import { getVariableSuggestions } from "../actions";

export default async function NewTemplatePage() {
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone, custom_fields")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const variableSuggestions = await getVariableSuggestions();

  const sampleContact = contact ?? { name: "রহিম উদ্দিন", phone: "8801712345678", custom_fields: {} };

  return <TemplateForm mode="create" sampleContact={sampleContact} variableSuggestions={variableSuggestions} />;
}
