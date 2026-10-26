import { IMPORT_CONSENT_TEXT } from "@whatsapp-saas/core/email/consent";
import EmailImportForm from "./EmailImportForm";

export default function EmailImportPage() {
  return <EmailImportForm consentText={IMPORT_CONSENT_TEXT} />;
}
