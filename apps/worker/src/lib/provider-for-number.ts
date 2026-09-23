import { EvolutionProvider } from "@whatsapp-saas/core/providers/evolution";
import { getSupabase } from "./supabase";

// whatsapp_numbers.id থেকে সেই নাম্বার কোন Evolution সার্ভারে আছে বের করে,
// সেই সার্ভারের জন্য একটা provider বানিয়ে দেয় (instance_name সহ)
export async function getProviderForNumber(
  numberId: string
): Promise<{ provider: EvolutionProvider; instanceName: string } | null> {
  const supabase = getSupabase();

  const { data: number } = await supabase
    .from("whatsapp_numbers")
    .select("instance_name, evolution_server_id")
    .eq("id", numberId)
    .maybeSingle();

  if (!number?.evolution_server_id) return null;

  const { data: server } = await supabase
    .from("evolution_servers")
    .select("api_url, api_key")
    .eq("id", number.evolution_server_id)
    .maybeSingle();

  if (!server) return null;

  return {
    provider: new EvolutionProvider({ apiUrl: server.api_url, apiKey: server.api_key }),
    instanceName: number.instance_name,
  };
}
