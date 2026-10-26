import { MANUAL_CONSENT_TEXT } from "@whatsapp-saas/core/email/consent";
import NewEmailContactForm from "./NewEmailContactForm";

export default function NewEmailContactPage() {
  return <NewEmailContactForm consentText={MANUAL_CONSENT_TEXT} />;
}
