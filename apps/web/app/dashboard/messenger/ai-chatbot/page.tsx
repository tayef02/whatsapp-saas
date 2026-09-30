import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import { Card, Badge } from "@/components/ui";

// এটা "শীঘ্রই" খোলস না — workspace_ai_settings/নলেজ বেস দুই চ্যানেলেই শেয়ার্ড (একই সিস্টেম
// প্রম্পট, একই ডকুমেন্ট), তাই এখানে আলাদা সেটিং বানানো হয়নি, শুধু সেটা জানিয়ে আসল সেটিংস
// পেজে পাঠানো হচ্ছে। এই তথ্য-কার্ডটা বাস্তব (fake "coming soon" না) — সেটিংস জেনুইনভাবে
// শেয়ার্ড, শুধু Messenger এর সাথে এখনো ওয়্যার করা হয়নি (M2 তে হবে)
export default function MessengerAiChatbotPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <Bot className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-text">এআই চ্যাটবট — শেয়ার্ড সেটিংস</h1>
          <p className="mt-1 text-sm text-text-muted">
            Messenger-এর জন্য আলাদা কোনো AI সেটিংস নেই — আপনার WhatsApp চ্যাটবটে যে system prompt, নলেজ বেস আর
            সাপোর্ট নাম্বার সেট করা আছে, পেজ কানেক্ট হওয়ার পর Messenger-এও সেই একই সেটিংস ব্যবহার হবে।
          </p>
        </div>

        <Badge variant="info">পেজ কানেক্ট হওয়ার পর সক্রিয় হবে</Badge>

        <Link
          href="/dashboard/ai-chatbot"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          চ্যাটবট সেটিংসে যান <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
