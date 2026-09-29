import { MessageSquare } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

// কথোপকথনের তালিকা এখন InboxShell/layout.tsx এ (বাঁ পাশের কলাম) — এই পেজটা শুধু ডেস্কটপে
// ডানপাশের ফাঁকা জায়গায় দেখায়, মোবাইলে লিস্ট ভিউ থাকা অবস্থায় এটা লুকানো থাকে
export default function InboxPage() {
  return (
    <Card className="flex h-full items-center justify-center">
      <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="একটা কথোপকথন বাছাই করুন" description="বাঁ পাশের তালিকা থেকে একটা কথোপকথনে ক্লিক করুন" />
    </Card>
  );
}
