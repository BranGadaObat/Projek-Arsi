import {
  addDays,
  dayOfWeek,
  formatDate,
  isHoliday,
  isWeekend,
  parseDate,
  type ProjectCalendar,
  type TaskDto,
} from "shared";
import { formatDateCompact, formatMonth } from "./format";

export type Zoom = "day" | "week" | "month";

export const DAY_WIDTH: Record<Zoom, number> = { day: 36, week: 12, month: 4 };
export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 56;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Timeline {
  start: Date;
  end: Date;
  dayWidth: number;
  days: number;
  width: number;
}

export function buildTimeline(tasks: TaskDto[], projectStart: string, zoom: Zoom): Timeline {
  const dates: Date[] = [parseDate(projectStart)];
  for (const task of tasks) {
    dates.push(parseDate(task.scheduledStart), parseDate(task.scheduledEnd));
  }
  const min = new Date(Math.min(...dates.map((date) => date.getTime())));
  const max = new Date(Math.max(...dates.map((date) => date.getTime())));
  const start = addDays(min, -3);
  const end = addDays(max, 10);
  const dayWidth = DAY_WIDTH[zoom];
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS + 1);
  return { start, end, dayWidth, days, width: Math.max(days * dayWidth, 720) };
}

export function xOfDate(date: Date, timeline: Timeline): number {
  return ((date.getTime() - timeline.start.getTime()) / DAY_MS) * timeline.dayWidth;
}

export function xOfIso(iso: string, timeline: Timeline): number {
  return xOfDate(parseDate(iso), timeline);
}

export function dateAtX(x: number, timeline: Timeline): Date {
  return addDays(timeline.start, Math.round(x / timeline.dayWidth));
}

export interface Tick {
  key: string;
  label: string;
  x: number;
  width: number;
  weekend: boolean;
  holiday: boolean;
  today: boolean;
}

export interface MonthBand {
  key: string;
  label: string;
  x: number;
  width: number;
}

function groupKey(date: Date, zoom: Zoom): string {
  if (zoom === "day") return formatDate(date);
  if (zoom === "week") {
    const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
    return `w-${formatDate(monday)}`;
  }
  return formatDate(date).slice(0, 7);
}

export function buildTicks(
  timeline: Timeline,
  zoom: Zoom,
  calendar: ProjectCalendar,
  todayIso: string,
): Tick[] {
  const ticks: Tick[] = [];
  let cursor = timeline.start;
  let current: Tick | null = null;
  let currentKey = "";

  while (cursor.getTime() <= timeline.end.getTime()) {
    const key = groupKey(cursor, zoom);
    if (key !== currentKey) {
      if (current) ticks.push(current);
      const width = timeline.dayWidth;
      current = {
        key,
        label:
          zoom === "day"
            ? String(cursor.getUTCDate())
            : zoom === "week"
              ? formatDateCompact(formatDate(cursor))
              : formatMonth(formatDate(cursor)),
        x: xOfDate(cursor, timeline),
        width,
        weekend: zoom === "day" ? isWeekend(cursor, calendar) : false,
        holiday: zoom === "day" ? isHoliday(cursor, calendar) : false,
        today: zoom === "day" && formatDate(cursor) === todayIso,
      };
      currentKey = key;
    }
    if (current) current.width += timeline.dayWidth;
    cursor = addDays(cursor, 1);
  }
  if (current) ticks.push(current);
  return ticks;
}

export function buildMonthBands(timeline: Timeline): MonthBand[] {
  const bands: MonthBand[] = [];
  let cursor = timeline.start;
  let key = formatDate(cursor).slice(0, 7);
  let bandStart = cursor;

  const pushBand = (endDate: Date): void => {
    bands.push({
      key,
      label: formatMonth(formatDate(bandStart)),
      x: xOfDate(bandStart, timeline),
      width: Math.max(
        (endDate.getTime() - bandStart.getTime()) / DAY_MS * timeline.dayWidth,
        timeline.dayWidth,
      ),
    });
  };

  while (cursor.getTime() <= timeline.end.getTime()) {
    const nextKey = formatDate(cursor).slice(0, 7);
    if (nextKey !== key) {
      pushBand(cursor);
      key = nextKey;
      bandStart = cursor;
    }
    cursor = addDays(cursor, 1);
  }
  pushBand(addDays(timeline.end, 1));
  return bands;
}

/** Tanggal hari ini dalam UTC (YYYY-MM-DD). */
export function todayIso(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export interface BarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  centerY: number;
}

export function barGeometry(
  task: { scheduledStart: string; scheduledEnd: string },
  timeline: Timeline,
  rowIndex: number,
): BarGeometry {
  const startX = xOfIso(task.scheduledStart, timeline);
  const endX = xOfIso(task.scheduledEnd, timeline) + timeline.dayWidth;
  const height = 22;
  const y = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - height) / 2;
  return {
    x: startX,
    y,
    width: Math.max(endX - startX, timeline.dayWidth),
    height,
    centerY: y + height / 2,
  };
}

export function dependencyPath(
  mode: "FS" | "SS",
  from: BarGeometry,
  to: BarGeometry,
): string {
  if (mode === "FS") {
    const startX = from.x + from.width;
    const endX = to.x - 7;
    const elbow = Math.max(startX + 10, Math.min(endX - 18, startX + 22));
    return `M ${startX} ${from.centerY} H ${elbow} V ${to.centerY} H ${endX}`;
  }
  const startX = from.x;
  const endX = to.x - 7;
  const elbow = Math.min(startX - 14, endX - 14);
  return `M ${startX} ${from.centerY} H ${elbow} V ${to.centerY} H ${endX}`;
}
