import { HTMLAttributes } from "react";

// সব কার্ড-আকৃতির বক্স (লিস্ট আইটেম, ফর্ম প্যানেল, স্ট্যাট কার্ড) এই একই বেস ব্যবহার করবে
export default function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}
