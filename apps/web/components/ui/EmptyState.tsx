import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// ডাটা নেই এমন জায়গায় (খালি লিস্ট) — শুধু "কিছু নেই" লেখার বদলে
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mb-3 text-text-muted">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
