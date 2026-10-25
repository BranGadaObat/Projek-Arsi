import { addDays, dayOfWeek, formatDate, parseDate } from "./dates.js";

export const DEFAULT_WEEKEND_DAYS = [0, 6];

export interface ProjectCalendar {
  weekendDays: number[];
  holidays: ReadonlySet<string>;
}

export function parseWeekendDays(value: string): number[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number.parseInt(part, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

export function serializeWeekendDays(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function createCalendar(
  weekendDays: number[],
  holidays: Iterable<string> = [],
): ProjectCalendar {
  return {
    weekendDays: [...new Set(weekendDays)].sort((a, b) => a - b),
    holidays: new Set(holidays),
  };
}

/** Mengembalikan pesan kesalahan, atau null jika konfigurasi sah. */
export function validateWeekendDays(days: number[]): string | null {
  if (days.length === 0) {
    return "Pilih minimal satu hari akhir pekan (boleh juga tidak sama sekali).";
  }
  if (days.length > 6) {
    return "Akhir pekan tidak boleh berisi ketujuh hari.";
  }
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return "Hari akhir pekan harus berupa angka 0 (Minggu) sampai 6 (Sabtu).";
    }
  }
  return null;
}

export function isWeekend(date: Date, calendar: ProjectCalendar): boolean {
  return calendar.weekendDays.includes(dayOfWeek(date));
}

export function isHoliday(date: Date, calendar: ProjectCalendar): boolean {
  return calendar.holidays.has(formatDate(date));
}

export function isWorkingDay(date: Date, calendar: ProjectCalendar): boolean {
  return !isWeekend(date, calendar) && !isHoliday(date, calendar);
}

/** Tanggal itu sendiri bila hari kerja, atau hari kerja berikutnya. */
export function nextWorkingDay(date: Date, calendar: ProjectCalendar): Date {
  let cursor = date;
  let guard = 0;
  while (!isWorkingDay(cursor, calendar)) {
    cursor = addDays(cursor, 1);
    guard += 1;
    if (guard > 4000) {
      throw new Error("Tidak ada hari kerja yang bisa ditemukan dalam rentang wajar.");
    }
  }
  return cursor;
}

/**
 * Menggeser sebanyak `count` hari kerja dari `date` (yang harus hari kerja).
 * `count` boleh negatif. count 0 mengembalikan `date`.
 */
export function shiftWorkingDays(date: Date, count: number, calendar: ProjectCalendar): Date {
  if (!Number.isInteger(count)) {
    throw new Error("Jumlah hari kerja harus bilangan bulat.");
  }
  let cursor = date;
  let remaining = Math.abs(count);
  const step = count >= 0 ? 1 : -1;
  let guard = 0;
  while (remaining > 0) {
    cursor = addDays(cursor, step);
    if (isWorkingDay(cursor, calendar)) {
      remaining -= 1;
    }
    guard += 1;
    if (guard > 4000) {
      throw new Error("Tidak ada hari kerja yang bisa ditemukan dalam rentang wajar.");
    }
  }
  return cursor;
}

/** Jumlah hari kerja inklusif dari `start` sampai `end` (0 bila end sebelum start). */
export function workingDaysBetween(start: Date, end: Date, calendar: ProjectCalendar): number {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  let cursor = start;
  let guard = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addDays(cursor, 1);
    guard += 1;
    if (guard > 4000) {
      throw new Error("Rentang tanggal terlalu panjang.");
    }
  }
  return count;
}

/**
 * Ordinal hari kerja: 0 untuk hari kerja pertama pada/ setelah tanggal mulai proyek.
 */
export function workingDayOrdinal(
  projectStart: Date,
  date: Date,
  calendar: ProjectCalendar,
): number {
  const first = nextWorkingDay(projectStart, calendar);
  if (date.getTime() < first.getTime()) {
    return -workingDaysBetween(date, addDays(first, -1), calendar);
  }
  return workingDaysBetween(first, date, calendar) - 1;
}

/** Semua hari kerja di antara dua tanggal (inklusif). */
export function workingDaysInRange(
  start: Date,
  end: Date,
  calendar: ProjectCalendar,
): Date[] {
  const result: Date[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    if (isWorkingDay(cursor, calendar)) result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

export function dateFromString(value: string): Date {
  return parseDate(value);
}
