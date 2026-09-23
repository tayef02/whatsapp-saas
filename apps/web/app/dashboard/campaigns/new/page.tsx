import { createClient } from "@/lib/supabase/server";
import NewCampaignForm from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase.from("templates").select("id, name").order("created_at", { ascending: false });
  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("id, display_name, status")
    .eq("status", "online");

  return <NewCampaignForm templates={templates ?? []} numbers={numbers ?? []} />;
}
