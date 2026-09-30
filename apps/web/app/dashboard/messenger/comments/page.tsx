import { MessageCircleReply } from "lucide-react";
import ComingSoon from "../ComingSoon";

export default function MessengerCommentsPage() {
  return (
    <ComingSoon
      icon={<MessageCircleReply className="h-10 w-10" />}
      title="কমেন্ট অটোমেশন"
      description="পোস্টের কমেন্টে অটো-রিপ্লাই/মডারেশন রুল — পেজ কানেক্ট হওয়ার পর এখান থেকে সেটআপ করা যাবে।"
    />
  );
}
