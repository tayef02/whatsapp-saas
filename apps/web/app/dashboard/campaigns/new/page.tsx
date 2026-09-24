import { createClient } from "@/lib/supabase/server";
import NewCampaignForm from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, content")
    .order("created_at", { ascending: false });

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name, status, min_delay_seconds, max_delay_seconds")
    .eq("status", "online");

  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone, custom_fields")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sampleContact = contact ?? { name: "রহিম উদ্দিন", phone: "8801712345678", custom_fields: {} };

  return <NewCampaignForm templates={templates ?? []} numbers={numbers ?? []} sampleContact={sampleContact} />;
}
