import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

// লেবেল + হেল্পার টেক্সট + এরর — সব ফর্মে এই একই শেপ। "use client" লাগে না, সার্ভার আর
// ক্লায়েন্ট দুই জায়গাতেই ব্যবহার করা যায় (name/defaultValue দিয়ে ফর্ম অ্যাকশনে, অথবা
// value/onChange দিয়ে কন্ট্রোল্ড ইনপুট হিসেবে)
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, className = "", id, ...props },
  ref
) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1.5 block font-medium text-text">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
      {helperText && !error && <span className="mt-1 block text-xs text-text-muted">{helperText}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
});

export default Input;
