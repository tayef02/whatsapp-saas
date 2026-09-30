import type { ReactNode } from "react";
import { Badge, EmptyState } from "@/components/ui";

// Messenger এর যেসব সাব-ফিচার এখনো বানানো হয়নি (M1-M5), সবগুলোতে এই একই খোলস —
// শুধু আইকন/টাইটেল/বর্ণনা বদলায়
export default function ComingSoon({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Badge variant="info" className="self-start">
        শীঘ্রই
      </Badge>
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
}
