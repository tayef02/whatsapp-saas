import { createClient } from "@/lib/supabase/server";
import QuietHoursForm from "./QuietHoursForm";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : { data: null };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(quiet_hours_start_hour, quiet_hours_end_hour)")
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | { quiet_hours_start_hour: number; quiet_hours_end_hour: number }
    | undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">সেটিংস</h1>
      <ProfileForm fullName={profile?.full_name ?? ""} />
      <PasswordForm />
      <QuietHoursForm
        startHour={workspace?.quiet_hours_start_hour ?? 22}
        endHour={workspace?.quiet_hours_end_hour ?? 9}
      />
    </div>
  );
}
