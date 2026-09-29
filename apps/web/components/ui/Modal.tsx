"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// ডিলিট কনফার্মেশনের মতো জায়গায় ব্যবহার হয় — open/onClose caller নিয়ন্ত্রণ করে
// (নিজের ভেতরে কোনো state রাখে না)
export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-text-muted hover:bg-gray-100" aria-label="বন্ধ করুন">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
