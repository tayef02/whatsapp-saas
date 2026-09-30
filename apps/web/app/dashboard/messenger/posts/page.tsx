import { CalendarClock } from "lucide-react";
import ComingSoon from "../ComingSoon";

export default function MessengerPostsPage() {
  return (
    <ComingSoon
      icon={<CalendarClock className="h-10 w-10" />}
      title="পোস্ট শিডিউলার"
      description="নির্দিষ্ট সময়ে পেজে টেক্সট/ছবি পোস্ট শিডিউল করা — পেজ কানেক্ট হওয়ার পর এখান থেকে করা যাবে।"
    />
  );
}
