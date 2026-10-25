import type {
  CpmNode,
  DependencyType,
  PertEdge,
  PertNode,
  PertResult,
  SchedulingDependency,
  SchedulingTask,
} from "./types.js";
import { leafTaskIds } from "./scheduler.js";

/** Estimasi PERT: te = (o + 4m + p) / 6 dan variansi ((p - o) / 6)^2. */
export function pertEstimate(
  optimistic: number,
  mostLikely: number,
  pessimistic: number,
): { te: number; variance: number } {
  const te = (optimistic + 4 * mostLikely + pessimistic) / 6;
  const variance = ((pessimistic - optimistic) / 6) ** 2;
  return { te, variance };
}

export function buildPert(input: {
  tasks: SchedulingTask[];
  cpmNodes: CpmNode[];
  criticalPath: string[];
  dependencies: SchedulingDependency[];
  estimates: Record<string, { optimisticDays: number | null; pessimisticDays: number | null }>;
}): PertResult {
  const { tasks, cpmNodes, criticalPath, dependencies, estimates } = input;
  const leafSet = new Set(leafTaskIds(tasks));
  const nodeById = new Map(cpmNodes.map((node) => [node.taskId, node]));
  const ids = cpmNodes.map((node) => node.taskId);

  const edges: PertEdge[] = dependencies
    .filter((dep) => leafSet.has(dep.predecessorId) && leafSet.has(dep.successorId))
    .filter((dep) => nodeById.has(dep.predecessorId) && nodeById.has(dep.successorId))
    .map((dep) => ({
      predecessorId: dep.predecessorId,
      successorId: dep.successorId,
      type: dep.type as DependencyType,
      critical: Boolean(nodeById.get(dep.predecessorId)?.critical && nodeById.get(dep.successorId)?.critical),
    }));

  // Kolom = kedalaman jalur terpanjang dari node awal.
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) {
    const list = incoming.get(edge.successorId);
    if (list) list.push(edge.predecessorId);
  }
  const columnMemo = new Map<string, number>();
  const columnOf = (id: string, visiting: Set<string> = new Set()): number => {
    const cached = columnMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const preds = incoming.get(id) ?? [];
    const column = preds.length === 0 ? 0 : Math.max(...preds.map((pred) => columnOf(pred, visiting) + 1));
    visiting.delete(id);
    columnMemo.set(id, column);
    return column;
  };

  const nodes: PertNode[] = cpmNodes.map((node) => {
    const column = columnOf(node.taskId);
    const estimate = estimates[node.taskId];
    const optimistic = estimate?.optimisticDays ?? null;
    const pessimistic = estimate?.pessimisticDays ?? null;
    const hasEstimate =
      optimistic !== null && pessimistic !== null && optimistic > 0 && pessimistic >= optimistic;
    const computed = hasEstimate ? pertEstimate(optimistic, node.duration, pessimistic) : null;
    return {
      ...node,
      column,
      te: computed ? Number(computed.te.toFixed(2)) : null,
      variance: computed ? Number(computed.variance.toFixed(4)) : null,
    };
  });

  const criticalSet = new Set(criticalPath);
  const criticalVariance = nodes
    .filter((node) => criticalSet.has(node.taskId) && node.variance !== null)
    .reduce((sum, node) => sum + (node.variance ?? 0), 0);

  return {
    nodes,
    edges,
    criticalVariance: Number(criticalVariance.toFixed(4)),
    criticalStdDev: Number(Math.sqrt(criticalVariance).toFixed(4)),
  };
}
