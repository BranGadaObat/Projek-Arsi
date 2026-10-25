import type { Priority } from "shared";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const compactDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID");

export function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateFormatter.format(toUtcDate(iso));
}

export function formatDateCompact(iso: string): string {
  return compactDateFormatter.format(toUtcDate(iso));
}

export function formatMonth(iso: string): string {
  return monthFormatter.format(toUtcDate(iso));
}

export function formatRupiah(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

export const WEEKDAY_FULL_LABELS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-surface-2 text-ink-2 border-line",
  MEDIUM: "bg-info-bg text-info border-info/20",
  HIGH: "bg-danger-bg text-danger border-danger/20",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralDays(days: number): string {
  return `${days} hari`;
}
