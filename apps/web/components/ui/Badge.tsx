import { HTMLAttributes } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  neutral: "bg-gray-100 text-text-muted",
};

// status দেখানোর জন্য রঙিন পিল — সব পেজে (অর্ডার/নাম্বার/কনভারসেশন/মেম্বার) এই একই কম্পোনেন্ট
export default function Badge({ variant = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
