import Skeleton from "./Skeleton";

type Variant = "table" | "form" | "cards" | "stats" | "detail";

// loading.tsx ফাইলগুলোতে ব্যবহারের জন্য — পেজের আসল কন্টেন্টের আকৃতির কাছাকাছি একটা স্কেলিটন
// দেখায়, যাতে ডেটা আসার পর লেআউট হঠাৎ লাফিয়ে না ওঠে। প্রতিটা পেজের জন্য আলাদা কাস্টম স্কেলিটন
// লেখার বদলে এই একটা কম্পোনেন্ট "variant" দিয়ে পেজের ধরন (টেবিল/ফর্ম/কার্ড-লিস্ট/স্ট্যাট/ডিটেইল)
// বেছে নেয়
export default function PageSkeleton({ variant = "detail", rows = 6 }: { variant?: Variant; rows?: number }) {
  if (variant === "table") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="mx-auto flex w-full max-w-[650px] flex-col gap-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "stats") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  // detail
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      {Array.from({ length: Math.max(2, Math.ceil(rows / 2)) }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
