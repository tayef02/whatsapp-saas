import { MessageSquare } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export default function MessengerInboxIndexPage() {
  return (
    <Card className="flex h-full items-center justify-center">
      <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="একটা কথোপকথন বাছাই করুন" description="বাঁ পাশের তালিকা থেকে একটা কথোপকথনে ক্লিক করুন" />
    </Card>
  );
}
