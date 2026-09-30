import { Inbox } from "lucide-react";
import ComingSoon from "../ComingSoon";

export default function MessengerInboxPage() {
  return (
    <ComingSoon
      icon={<Inbox className="h-10 w-10" />}
      title="Messenger ইনবক্স"
      description="পেজ কানেক্ট হওয়ার পর কাস্টমারদের Messenger কথোপকথন এখানে দেখা যাবে।"
    />
  );
}
