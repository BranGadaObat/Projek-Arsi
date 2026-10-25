import type { ReactNode } from "react";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-ink-2",
  brand: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-success/20 bg-success-bg text-success",
  warning: "border-warning/20 bg-warning-bg text-warning",
  danger: "border-danger/20 bg-danger-bg text-danger",
  info: "border-info/20 bg-info-bg text-info",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  label,
}: {
  value: number;
  tone?: "brand" | "success" | "warning";
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-brand-500";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progres"}
    >
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Spinner({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
      />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-sm ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
      <div className="max-w-sm">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const iconTone = TONE_CLASSES[tone];
  return (
    <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-4 shadow-sm">
      {icon ? <div className={`grid size-9 shrink-0 place-items-center rounded-md border ${iconTone}`}>{icon}</div> : null}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
        <p className="tabular mt-1 truncate text-xl font-semibold tracking-tight text-ink">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-md border border-danger/25 bg-danger-bg/60 p-4">
      <p className="text-sm font-semibold text-danger">Data gagal dimuat</p>
      <p className="mt-1 text-[13px] text-danger/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-sm border border-danger/30 bg-surface px-3 py-1.5 text-[13px] font-medium text-danger hover:bg-danger-bg"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-md border border-line bg-surface shadow-sm ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-3">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
