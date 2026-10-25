import { useState } from "react";
import { WEEKDAY_LABELS, formatDate } from "../../lib/format";
import { Button } from "../ui/Button";
import { ChevronRightIcon } from "../ui/Icons";

interface MonthCalendarProps {
  weekendDays: number[];
  holidays: string[];
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Kalender bulanan mini yang menandai akhir pekan dan hari libur. */
export function MonthCalendar({ weekendDays, holidays }: MonthCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const leading = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const holidaySet = new Set(holidays);

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);

  function move(step: number): void {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + step, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => iso(cursor.year, cursor.month, index + 1)),
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" aria-label="Bulan sebelumnya" onClick={() => move(-1)}>
          <ChevronRightIcon className="size-3.5 rotate-180" />
        </Button>
        <p className="text-[13px] font-semibold text-ink">{monthLabel}</p>
        <Button variant="secondary" size="sm" aria-label="Bulan berikutnya" onClick={() => move(1)}>
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={monthLabel}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            {label}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`blank-${index}`} aria-hidden="true" className="aspect-square" />;
          }
          const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
          const isWeekend = weekendDays.includes(dow);
          const isHoliday = holidaySet.has(date);
          const day = Number(date.slice(8, 10));
          const label = isHoliday
            ? `${formatDate(date)} — hari libur`
            : isWeekend
              ? `${formatDate(date)} — akhir pekan`
              : formatDate(date);
          return (
            <div
              key={date}
              role="gridcell"
              aria-label={label}
              title={label}
              className={`tabular grid aspect-square place-items-center rounded-sm border text-[12px] ${
                isHoliday
                  ? "border-danger/30 bg-danger-bg font-semibold text-danger"
                  : isWeekend
                    ? "border-line bg-surface-2 text-ink-3"
                    : "border-transparent bg-surface text-ink"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-surface-2 ring-1 ring-line" /> Akhir pekan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger-bg ring-1 ring-danger/30" /> Hari libur
        </span>
      </p>
    </div>
  );
}
