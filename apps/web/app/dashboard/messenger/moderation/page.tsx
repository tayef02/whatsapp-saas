import { ShieldAlert } from "lucide-react";
import ComingSoon from "../ComingSoon";

export default function MessengerModerationPage() {
  return (
    <ComingSoon
      icon={<ShieldAlert className="h-10 w-10" />}
      title="মডারেশন"
      description="স্প্যাম/ব্যানড-ওয়ার্ড ফিল্টার আর কমেন্ট মডারেশন — পেজ কানেক্ট হওয়ার পর এখান থেকে সেটআপ করা যাবে।"
    />
  );
}
