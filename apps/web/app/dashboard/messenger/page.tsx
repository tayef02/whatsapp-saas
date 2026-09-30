import { MessageSquare } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";

// শুধু খোলস (Phase M0) — বাটন নিষ্ক্রিয়, কোনো OAuth/কানেক্ট লজিক এখনো নেই (M1 এ আসবে)
export default function MessengerConnectPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <MessageSquare className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-text">Facebook পেজ কানেক্ট করুন</h1>
          <p className="mt-1 text-sm text-text-muted">
            একটা Facebook পেজ কানেক্ট করলে সেই পেজের Messenger ইনবক্স, কমেন্ট অটোমেশন আর পোস্ট শিডিউলার এখান থেকে ম্যানেজ করতে পারবেন।
          </p>
        </div>

        <Badge variant="warning">Meta অনুমোদনের অপেক্ষায়</Badge>

        <Button disabled className="w-full">
          পেজ কানেক্ট করুন
        </Button>
        <p className="text-xs text-text-muted">Meta অনুমোদনের পর চালু হবে।</p>
      </Card>
    </div>
  );
}
