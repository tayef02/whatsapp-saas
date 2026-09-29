import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WelcomeForm from "./WelcomeForm";

export default async function GroupWelcomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, welcome_enabled, welcome_message").eq("id", id).maybeSingle();
  if (!group) notFound();

  return <WelcomeForm groupId={id} initialEnabled={group.welcome_enabled} initialMessage={group.welcome_message ?? ""} />;
}
