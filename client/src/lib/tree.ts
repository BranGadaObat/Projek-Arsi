import type { AssignmentDto, ResourceDto, TaskDto } from "shared";

export interface TaskNode {
  task: TaskDto;
  depth: number;
  children: TaskNode[];
}

export interface FlatTaskRow {
  task: TaskDto;
  depth: number;
  hasChildren: boolean;
}

export function buildTaskTree(tasks: TaskDto[]): TaskNode[] {
  const byParent = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(task);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  const seen = new Set<string>();
  const build = (parentId: string | null, depth: number): TaskNode[] => {
    const children = byParent.get(parentId) ?? [];
    return children.map((task) => {
      seen.add(task.id);
      return { task, depth, children: build(task.id, depth + 1) };
    });
  };
  const roots = build(null, 0);
  // Tugas yang induknya tidak dikenal tetap ditampilkan.
  for (const task of tasks) {
    if (!seen.has(task.id)) roots.push({ task, depth: 0, children: [] });
  }
  return roots;
}

export function flattenTree(nodes: TaskNode[], collapsed: Set<string>): FlatTaskRow[] {
  const rows: FlatTaskRow[] = [];
  const walk = (list: TaskNode[]): void => {
    for (const node of list) {
      const hasChildren = node.children.length > 0;
      rows.push({ task: node.task, depth: node.depth, hasChildren });
      if (hasChildren && !collapsed.has(node.task.id)) walk(node.children);
    }
  };
  walk(nodes);
  return rows;
}

/** Semua id tugas yang merupakan induk. */
export function parentTaskIds(tasks: TaskDto[]): Set<string> {
  return new Set(tasks.filter((task) => task.parentId).map((task) => task.parentId as string));
}

export function leafTasks(tasks: TaskDto[]): TaskDto[] {
  const parents = parentTaskIds(tasks);
  return tasks.filter((task) => !parents.has(task.id));
}

export function childrenOf(tasks: TaskDto[], taskId: string): TaskDto[] {
  return tasks
    .filter((task) => task.parentId === taskId)
    .sort((a, b) => a.position - b.position);
}

export function descendantsOf(tasks: TaskDto[], taskId: string): TaskDto[] {
  const result: TaskDto[] = [];
  const walk = (parentId: string): void => {
    for (const child of childrenOf(tasks, parentId)) {
      result.push(child);
      walk(child.id);
    }
  };
  walk(taskId);
  return result;
}

export function taskDepth(tasks: TaskDto[], taskId: string): number {
  let depth = 1;
  let cursor = tasks.find((task) => task.id === taskId);
  const guard = new Set<string>();
  while (cursor?.parentId && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    cursor = tasks.find((task) => task.id === cursor?.parentId);
    depth += 1;
  }
  return depth;
}

/** Label WBS seperti 1, 1.1, 1.2.1. */
export function wbsLabels(tasks: TaskDto[]): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (parentId: string | null, prefix: string[]): void => {
    const siblings = tasks
      .filter((task) => (task.parentId ?? null) === parentId)
      .sort((a, b) => a.position - b.position);
    siblings.forEach((task, index) => {
      const label = [...prefix, String(index + 1)].join(".");
      labels.set(task.id, label);
      walk(task.id, [...prefix, String(index + 1)]);
    });
  };
  walk(null, []);
  return labels;
}

export function assignmentSummary(
  taskId: string,
  assignments: AssignmentDto[],
  resources: ResourceDto[],
): string {
  const names = assignments
    .filter((assignment) => assignment.taskId === taskId)
    .map((assignment) => {
      const resource = resources.find((item) => item.id === assignment.resourceId);
      if (!resource) return null;
      return assignment.allocationPercent === 100
        ? resource.name
        : `${resource.name} (${assignment.allocationPercent}%)`;
    })
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : "—";
}
