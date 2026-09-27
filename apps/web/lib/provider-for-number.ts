import { EvolutionProvider } from "@whatsapp-saas/core/providers/evolution";
import { createAdminClient } from "./supabase/admin";

// whatsapp_numbers.id থেকে Evolution সার্ভারের ক্রেডেনশিয়াল বের করে provider বানায়।
// admin ক্লায়েন্ট ব্যবহার হয় কারণ evolution_servers এ authenticated এর কোনো GRANT নেই —
// এই ফাংশন কল করার *আগে* caller কে অবশ্যই RLS-স্কোপড ক্লায়েন্ট দিয়ে যাচাই করতে হবে যে
// এই numberId টা কলারের নিজের workspace এর, নাহলে অন্য workspace এর নাম্বারের সার্ভার তথ্যও বের হয়ে যাবে
export async function getProviderForNumber(
  numberId: string
): Promise<{ provider: EvolutionProvider; instanceName: string } | null> {
  const admin = createAdminClient();

  const { data: number } = await admin
    .from("whatsapp_numbers")
    .select("instance_name, evolution_server_id")
    .eq("id", numberId)
    .maybeSingle();

  if (!number?.evolution_server_id) return null;

  const { data: server } = await admin
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
