import { compareDates, formatDate, maxDate, parseDate } from "./dates.js";
import {
  nextWorkingDay,
  shiftWorkingDays,
  workingDaysBetween,
  type ProjectCalendar,
} from "./calendar.js";
import type {
  SchedulingDependency,
  SchedulingTask,
  ScheduledValues,
} from "./types.js";

interface Graph {
  leafIds: string[];
  childrenOf: Map<string, string[]>;
  predecessorsOf: Map<string, SchedulingDependency[]>;
  successorsOf: Map<string, SchedulingDependency[]>;
}

function buildGraph(tasks: SchedulingTask[], dependencies: SchedulingDependency[]): Graph {
  const childrenOf = new Map<string, string[]>();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (task.parentId && byId.has(task.parentId)) {
      const list = childrenOf.get(task.parentId) ?? [];
      list.push(task.id);
      childrenOf.set(task.parentId, list);
    }
  }
  const leafIds = tasks.filter((task) => !childrenOf.has(task.id)).map((task) => task.id);
  const leafSet = new Set(leafIds);

  const predecessorsOf = new Map<string, SchedulingDependency[]>();
  const successorsOf = new Map<string, SchedulingDependency[]>();
  for (const dep of dependencies) {
    if (!leafSet.has(dep.predecessorId) || !leafSet.has(dep.successorId)) continue;
    const preds = predecessorsOf.get(dep.successorId) ?? [];
    preds.push(dep);
    predecessorsOf.set(dep.successorId, preds);
    const succs = successorsOf.get(dep.predecessorId) ?? [];
    succs.push(dep);
    successorsOf.set(dep.predecessorId, succs);
  }
  return { leafIds, childrenOf, predecessorsOf, successorsOf };
}

/** Urutan topologis tugas daun (Kahn). Tugas yang terlibat siklus diletakkan di akhir. */
export function topologicalLeafOrder(
  tasks: SchedulingTask[],
  dependencies: SchedulingDependency[],
): string[] {
  const { leafIds, predecessorsOf, successorsOf } = buildGraph(tasks, dependencies);
  const indegree = new Map<string, number>();
  for (const id of leafIds) indegree.set(id, 0);
  for (const id of leafIds) {
    for (const _dep of predecessorsOf.get(id) ?? []) {
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }
  const queue = leafIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const dep of successorsOf.get(id) ?? []) {
      const next = (indegree.get(dep.successorId) ?? 0) - 1;
      indegree.set(dep.successorId, next);
      if (next === 0) queue.push(dep.successorId);
    }
  }
  for (const id of leafIds) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

/** Batas hari kerja paling awal yang dipaksakan predecessor untuk seorang penerus. */
export function predecessorBoundary(
  dep: SchedulingDependency,
  predecessor: ScheduledValues,
  calendar: ProjectCalendar,
): Date {
  const predStart = parseDate(predecessor.scheduledStart);
  const predEnd = parseDate(predecessor.scheduledEnd);
  if (dep.type === "SS") {
    return shiftWorkingDays(predStart, dep.lagDays, calendar);
  }
  return shiftWorkingDays(predEnd, 1 + dep.lagDays, calendar);
}

/**
 * Menjalankan penjadwalan penuh: tugas daun menurut dependensi, lalu roll-up induk.
 * Hasil memuat seluruh tugas (daun dan induk).
 */
export function scheduleProject(
  tasks: SchedulingTask[],
  dependencies: SchedulingDependency[],
  calendar: ProjectCalendar,
): Map<string, ScheduledValues> {
  const { childrenOf, predecessorsOf } = buildGraph(tasks, dependencies);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const result = new Map<string, ScheduledValues>();

  const order = topologicalLeafOrder(tasks, dependencies);
  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    let earliest = parseDate(task.startDate);
    for (const dep of predecessorsOf.get(id) ?? []) {
      const pred = result.get(dep.predecessorId);
      if (!pred) continue;
      earliest = maxDate(earliest, predecessorBoundary(dep, pred, calendar));
    }
    const scheduledStart = nextWorkingDay(earliest, calendar);
    const duration = Math.max(1, task.durationDays);
    const scheduledEnd = shiftWorkingDays(scheduledStart, duration - 1, calendar);
    result.set(id, {
      scheduledStart: formatDate(scheduledStart),
      scheduledEnd: formatDate(scheduledEnd),
      durationDays: duration,
      progress: clampProgress(task.progress),
    });
  }

  // Roll-up induk dari level terdalam ke permukaan.
  const depthOf = (task: SchedulingTask): number => {
    let depth = 0;
    let cursor: SchedulingTask | undefined = task;
    while (cursor?.parentId) {
      cursor = byId.get(cursor.parentId);
      depth += 1;
      if (depth > 10) break;
    }
    return depth;
  };
  const parents = tasks
    .filter((task) => (childrenOf.get(task.id)?.length ?? 0) > 0)
    .sort((a, b) => depthOf(b) - depthOf(a));

  for (const parent of parents) {
    const childIds = childrenOf.get(parent.id) ?? [];
    const childValues = childIds
      .map((childId) => result.get(childId))
      .filter((value): value is ScheduledValues => Boolean(value));
    if (childValues.length === 0) continue;
    let start = parseDate(childValues[0].scheduledStart);
    let end = parseDate(childValues[0].scheduledEnd);
    for (const value of childValues.slice(1)) {
      start = compareDates(parseDate(value.scheduledStart), start) < 0 ? parseDate(value.scheduledStart) : start;
      const childEnd = parseDate(value.scheduledEnd);
      if (compareDates(childEnd, end) > 0) end = childEnd;
    }
    const totalDuration = childValues.reduce((sum, value) => sum + value.durationDays, 0);
    const weightedProgress =
      totalDuration > 0
        ? childValues.reduce((sum, value) => sum + value.progress * value.durationDays, 0) /
          totalDuration
        : 0;
    result.set(parent.id, {
      scheduledStart: formatDate(start),
      scheduledEnd: formatDate(end),
      durationDays: workingDaysBetween(start, end, calendar),
      progress: Math.round(weightedProgress),
    });
  }

  // Tugas tanpa nilai (mis. data kosong) tetap diberi nilai agar UI tidak kosong.
  for (const task of tasks) {
    if (result.has(task.id)) continue;
    const start = nextWorkingDay(parseDate(task.startDate), calendar);
    result.set(task.id, {
      scheduledStart: formatDate(start),
      scheduledEnd: formatDate(start),
      durationDays: Math.max(1, task.durationDays),
      progress: clampProgress(task.progress),
    });
  }

  return result;
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Daftar tugas daun (tanpa anak) dari kumpulan tugas. */
export function leafTaskIds(tasks: SchedulingTask[]): string[] {
  const parentIds = new Set(tasks.filter((task) => task.parentId).map((task) => task.parentId as string));
  return tasks.filter((task) => !parentIds.has(task.id)).map((task) => task.id);
}
