import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, className = "", id, children, ...props },
  ref
) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1.5 block font-medium text-text">{label}</span>}
      <select
        ref={ref}
        id={id}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {helperText && !error && <span className="mt-1 block text-xs text-text-muted">{helperText}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
});

export default Select;
