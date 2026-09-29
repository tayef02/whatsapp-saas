import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FiltersForm from "./FiltersForm";

export default async function GroupFiltersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id").eq("id", id).maybeSingle();
  if (!group) notFound();

  const { data: filters } = await supabase.from("workspace_group_filters").select("banned_words, banned_link_patterns").maybeSingle();

  return <FiltersForm initialBannedWords={filters?.banned_words ?? []} initialBannedLinkPatterns={filters?.banned_link_patterns ?? []} />;
}
