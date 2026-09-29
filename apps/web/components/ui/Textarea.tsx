import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, className = "", id, ...props },
  ref
) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1.5 block font-medium text-text">{label}</span>}
      <textarea
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

export default Textarea;
