import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupTabs from "./GroupTabs";

export default async function GroupDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, name, whatsapp_numbers(display_name)").eq("id", id).maybeSingle();
  if (!group) notFound();

  const number = Array.isArray(group.whatsapp_numbers) ? group.whatsapp_numbers[0] : group.whatsapp_numbers;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/groups" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> গ্রুপ লিস্টে ফিরুন
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-text">{group.name || "(নাম নেই)"}</h1>
        {number?.display_name && <p className="text-xs text-text-muted">{number.display_name}</p>}
      </div>

      <GroupTabs groupId={id} />

      {children}
    </div>
  );
}
