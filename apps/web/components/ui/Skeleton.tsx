import { HTMLAttributes } from "react";

// লোড হওয়ার সময় (client-side পোলিং/fetch) ধূসর placeholder দেখাতে
export default function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} {...props} />;
}
