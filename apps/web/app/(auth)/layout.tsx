import { getLang } from "@/app/(marketing)/_lib/get-lang";
import AuthShell from "./_components/AuthShell";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return <AuthShell lang={lang}>{children}</AuthShell>;
}
