"use client";

import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-white text-text border border-border hover:bg-gray-50",
  danger: "bg-danger text-white hover:bg-red-700",
  ghost: "bg-transparent text-text-muted hover:bg-gray-100",
};

// প্রজেক্টের সব বাটন এই কম্পোনেন্ট দিয়ে — variant দিয়ে রঙ বদলায়, loading=true দিলে
// স্পিনার দেখায় আর বাটন disable হয়ে যায় (ডাবল-ক্লিকে ডাবল সাবমিট ঠেকাতে)
export default function Button({ variant = "primary", loading, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
