import { parseDate } from "./dates.js";
import { workingDayOrdinal, type ProjectCalendar } from "./calendar.js";

import { leafTaskIds, topologicalLeafOrder } from "./scheduler.js";
import type { CpmNode, CpmResult, ScheduledTask, SchedulingDependency } from "./types.js";

interface LeafInfo {
  id: string;
  name: string;
  duration: number;
  es: number;
  ef: number;
}

/**
 * Critical Path Method untuk tugas daun.
 * Ordinal hari kerja dihitung dari hari kerja pertama pada/ setelah tanggal mulai proyek.
 */
export function computeCpm(input: {
  tasks: ScheduledTask[];
  taskNames: Record<string, string>;
  dependencies: SchedulingDependency[];
  projectStartDate: string;
  calendar: ProjectCalendar;
}): CpmResult {
  const { tasks, taskNames, dependencies, projectStartDate, calendar } = input;
  const leaves = leafTaskIds(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const leafSet = new Set(leaves);
  const ord = (date: string): number =>
    workingDayOrdinal(parseDate(projectStartDate), parseDate(date), calendar);

  const info = new Map<string, LeafInfo>();
  for (const id of leaves) {
    const task = byId.get(id);
    if (!task) continue;
    const es = ord(task.scheduledStart);
    const ef = ord(task.scheduledEnd);
    info.set(id, {
      id,
      name: taskNames[id] ?? task.id,
      duration: Math.max(1, ef - es + 1),
      es,
      ef,
    });
  }

  const projectEnd = info.size === 0 ? 0 : Math.max(...[...info.values()].map((node) => node.ef));

  const successorDeps = new Map<string, SchedulingDependency[]>();
  for (const dep of dependencies) {
    if (!leafSet.has(dep.predecessorId) || !leafSet.has(dep.successorId)) continue;
    const list = successorDeps.get(dep.predecessorId) ?? [];
    list.push(dep);
    successorDeps.set(dep.predecessorId, list);
  }

  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  const order = topologicalLeafOrder(tasks, dependencies);
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const id = order[index];
    const node = info.get(id);
    if (!node) continue;
    const successors = (successorDeps.get(id) ?? []).filter((dep) => info.has(dep.successorId));
    let latestFinish: number;
    if (successors.length === 0) {
      latestFinish = projectEnd;
    } else {
      latestFinish = Number.POSITIVE_INFINITY;
      for (const dep of successors) {
        const succLs = ls.get(dep.successorId);
        if (succLs === undefined) continue;
        const candidate =
          dep.type === "SS"
            ? succLs - dep.lagDays + node.duration - 1
            : succLs - 1 - dep.lagDays;
        latestFinish = Math.min(latestFinish, candidate);
      }
      if (!Number.isFinite(latestFinish)) latestFinish = projectEnd;
    }
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - node.duration + 1);
  }

  const nodes: CpmNode[] = [];
  for (const node of info.values()) {
    const latestStart = ls.get(node.id) ?? node.es;
    const latestFinish = lf.get(node.id) ?? node.ef;
    const totalFloat = Math.max(0, latestStart - node.es);
    nodes.push({
      taskId: node.id,
      name: node.name,
      duration: node.duration,
      es: node.es,
      ef: node.ef,
      ls: latestStart,
      lf: latestFinish,
      totalFloat,
      critical: totalFloat === 0,
    });
  }
  nodes.sort((a, b) => a.es - b.es || a.name.localeCompare(b.name));

  return {
    nodes,
    projectEnd,
    criticalPath: buildCriticalPath(nodes, dependencies, leafSet),
  };
}

/**
 * Rangkaian tugas kritis yang saling terhubung, diurutkan menurut ES.
 * Bila ada beberapa kemungkinan, dipilih rantai terpanjang.
 */
export function buildCriticalPath(
  nodes: CpmNode[],
  dependencies: SchedulingDependency[],
  leafSet: Set<string>,
): string[] {
  const critical = new Map(nodes.filter((node) => node.critical).map((node) => [node.taskId, node]));
  if (critical.size === 0) return [];

  const successors = new Map<string, string[]>();
  const hasCriticalPredecessor = new Set<string>();
  for (const dep of dependencies) {
    if (!leafSet.has(dep.predecessorId) || !leafSet.has(dep.successorId)) continue;
    if (!critical.has(dep.predecessorId) || !critical.has(dep.successorId)) continue;
    const list = successors.get(dep.predecessorId) ?? [];
    list.push(dep.successorId);
    successors.set(dep.predecessorId, list);
    hasCriticalPredecessor.add(dep.successorId);
  }

  const memo = new Map<string, string[]>();
  const longestFrom = (id: string): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    memo.set(id, [id]); // guard terhadap kemungkinan edge duplikat
    let best: string[] = [id];
    for (const next of successors.get(id) ?? []) {
      const candidate = [id, ...longestFrom(next)];
      if (candidate.length > best.length) best = candidate;
    }
    memo.set(id, best);
    return best;
  };

  let bestPath: string[] = [];
  const starts = [...critical.keys()].filter((id) => !hasCriticalPredecessor.has(id));
  for (const start of starts.length > 0 ? starts : [...critical.keys()]) {
    const path = longestFrom(start);
    if (path.length > bestPath.length) bestPath = path;
  }
  return bestPath;
}
