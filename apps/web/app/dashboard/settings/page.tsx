import { createClient } from "@/lib/supabase/server";
import QuietHoursForm from "./QuietHoursForm";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(quiet_hours_start_hour, quiet_hours_end_hour)")
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | { quiet_hours_start_hour: number; quiet_hours_end_hour: number }
    | undefined;

  return (
    <QuietHoursForm
      startHour={workspace?.quiet_hours_start_hour ?? 22}
      endHour={workspace?.quiet_hours_end_hour ?? 9}
    />
  );
}
