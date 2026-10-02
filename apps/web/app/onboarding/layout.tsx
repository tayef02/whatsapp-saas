import { getLang } from "@/app/(marketing)/_lib/get-lang";
import AuthShell from "../(auth)/_components/AuthShell";

// সাইনআপের ঠিক পরের ধাপ — লগইন/সাইনআপের মতোই একই ভাষা ও টগল, নইলে English সাইনআপের পর হঠাৎ
// বাংলা পেজ আসত
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return <AuthShell lang={lang}>{children}</AuthShell>;
}
