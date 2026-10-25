import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className = "" }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-3">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
  function Input({ className = "", error, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={error || undefined}
        className={`${CONTROL_CLASSES} h-10 ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(function Textarea({ className = "", error, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={`${CONTROL_CLASSES} py-2 ${error ? "border-danger" : ""} ${className}`}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }
>(function Select({ className = "", error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={error || undefined}
      className={`${CONTROL_CLASSES} h-10 pr-8 ${error ? "border-danger" : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

/** Label + input dengan id otomatis, dipakai pada form yang sederhana. */
export function LabeledInput({
  label,
  hint,
  error,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <Input id={id} error={Boolean(error)} {...props} />
    </Field>
  );
}
