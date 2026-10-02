"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationBaseProps = {
  currentPage: number;
  totalPages: number;
  loading?: boolean;
};

// দুই রকম ব্যবহার সাপোর্ট করে: hrefTemplate দিলে <Link> (সার্ভার-সাইড পেজ, URL এ ?page=) —
// contacts/groups-messages এর বিদ্যমান প্যাটার্নের মতো, onPageChange দিলে client-side state
// (যেমন ইনবক্স কনভারসেশন লিস্ট, যেটা layout এ একবার ফেচ হয়ে সাইডবারে স্থায়ী থাকে)।
//
// hrefTemplate একটা প্লেইন স্ট্রিং (ফাংশন না) — কারণ এই কম্পোনেন্ট "use client", আর Next.js
// এ সার্ভার কম্পোনেন্ট থেকে ক্লায়েন্ট কম্পোনেন্টে সরাসরি ফাংশন prop পাঠানো যায় না। লেখার
// নিয়ম: "{page}" প্লেসহোল্ডার, যেমন "/dashboard/campaigns?page={page}" — এখানে প্রতিটা পেজ
// নম্বরের জায়গায় বসিয়ে URL বানানো হয়।
type PaginationProps = PaginationBaseProps &
  ({ hrefTemplate: string; onPageChange?: undefined } | { onPageChange: (page: number) => void; hrefTemplate?: undefined });

// ১ থেকে totalPages পর্যন্ত কোন সংখ্যাগুলো আর কোথায় "..." বসবে তার হিসাব — সবসময় প্রথম/শেষ
// পেজ আর বর্তমান পেজের আশেপাশে ১টা করে দেখায়, বাকিটা ellipsis দিয়ে ভাঁজ করে
function getPageItems(current: number, total: number): (number | "ellipsis")[] {
  const siblingCount = 1;
  const totalVisible = siblingCount * 2 + 5; // প্রথম + শেষ + current + ২ sibling + ২ ellipsis slot
  if (total <= totalVisible) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblingCount, 1);
  const right = Math.min(current + siblingCount, total);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const count = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: count }, (_, i) => total - count + 1 + i);
    return [1, "ellipsis", ...rightRange];
  }
  const middleRange = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

function bn(n: number) {
  return n.toLocaleString("bn-BD");
}

// প্রতিটা বাটন/লিংক কমপক্ষে ৪০x৪০px (h-10/min-w-10) — টাচ-ফ্রেন্ডলি
export default function Pagination({ currentPage, totalPages, loading, hrefTemplate, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const atFirst = currentPage <= 1;
  const atLast = currentPage >= totalPages;
  const items = getPageItems(currentPage, totalPages);

  function buildHref(page: number) {
    return hrefTemplate!.replace("{page}", String(page));
  }

  function go(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  }

  function pageButtonClass(active: boolean) {
    return `inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
      active ? "bg-primary text-white" : "text-text hover:bg-gray-100"
    }`;
  }

  function navButtonClass(disabled: boolean) {
    return `inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition-colors ${
      disabled ? "cursor-not-allowed text-text-muted opacity-50" : "text-text hover:bg-gray-100"
    }`;
  }

  const prevDisabled = atFirst || Boolean(loading);
  const nextDisabled = atLast || Boolean(loading);

  const PrevContent = (
    <>
      <ChevronLeft className="h-4 w-4" /> আগের
    </>
  );
  const NextContent = (
    <>
      পরের <ChevronRight className="h-4 w-4" />
    </>
  );

  return (
    <nav aria-label="পেজিনেশন" className="flex items-center justify-between gap-2">
      {/* ডেস্কটপ — নম্বর সহ পূর্ণ পেজিনেশন */}
      <div className="hidden items-center gap-1 sm:flex">
        {hrefTemplate && !prevDisabled ? (
          <Link href={buildHref(currentPage - 1)} className={navButtonClass(false)} aria-label="আগের পেজ">
            {PrevContent}
          </Link>
        ) : (
          <button type="button" disabled={prevDisabled} onClick={() => go(currentPage - 1)} className={navButtonClass(prevDisabled)} aria-label="আগের পেজ">
            {PrevContent}
          </button>
        )}

        {items.map((item, i) =>
          item === "ellipsis" ? (
            <span key={`e-${i}`} className="flex h-10 w-10 items-center justify-center text-text-muted">
              …
            </span>
          ) : hrefTemplate ? (
            <Link
              key={item}
              href={buildHref(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={pageButtonClass(item === currentPage)}
            >
              {bn(item)}
            </Link>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={pageButtonClass(item === currentPage)}
            >
              {bn(item)}
            </button>
          )
        )}

        {hrefTemplate && !nextDisabled ? (
          <Link href={buildHref(currentPage + 1)} className={navButtonClass(false)} aria-label="পরের পেজ">
            {NextContent}
          </Link>
        ) : (
          <button type="button" disabled={nextDisabled} onClick={() => go(currentPage + 1)} className={navButtonClass(nextDisabled)} aria-label="পরের পেজ">
            {NextContent}
          </button>
        )}
      </div>

      {/* মোবাইল — কমপ্যাক্ট "আগের | পেজ ২/১০ | পরের" */}
      <div className="flex w-full items-center justify-between gap-2 sm:hidden">
        {hrefTemplate && !prevDisabled ? (
          <Link href={buildHref(currentPage - 1)} className={navButtonClass(false)} aria-label="আগের পেজ">
            {PrevContent}
          </Link>
        ) : (
          <button type="button" disabled={prevDisabled} onClick={() => go(currentPage - 1)} className={navButtonClass(prevDisabled)} aria-label="আগের পেজ">
            {PrevContent}
          </button>
        )}

        <span className="text-sm font-medium text-text-muted" aria-current="page">
          পেজ {bn(currentPage)}/{bn(totalPages)}
        </span>

        {hrefTemplate && !nextDisabled ? (
          <Link href={buildHref(currentPage + 1)} className={navButtonClass(false)} aria-label="পরের পেজ">
            {NextContent}
          </Link>
        ) : (
          <button type="button" disabled={nextDisabled} onClick={() => go(currentPage + 1)} className={navButtonClass(nextDisabled)} aria-label="পরের পেজ">
            {NextContent}
          </button>
        )}
      </div>
    </nav>
  );
}
