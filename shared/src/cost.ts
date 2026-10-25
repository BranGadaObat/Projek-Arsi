import { parseDate, formatDate } from "./dates.js";
import { workingDaysInRange, type ProjectCalendar } from "./calendar.js";
import { leafTaskIds } from "./scheduler.js";
import type {
  AssignmentDto,
  CostBreakdown,
  ResourceDto,
  ResourceLoad,
  ScheduledTask,
} from "./types.js";

export const WORKING_DAYS_PER_MONTH = 22;

export type CostTask = ScheduledTask;

export function dailyRate(salary: number): number {
  return salary / WORKING_DAYS_PER_MONTH;
}

export function taskCost(
  task: CostTask,
  resources: ResourceDto[],
  assignments: AssignmentDto[],
): number {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return assignments
    .filter((assignment) => assignment.taskId === task.id)
    .reduce((sum, assignment) => {
      const resource = byId.get(assignment.resourceId);
      if (!resource) return sum;
      return sum + dailyRate(resource.salary) * task.durationDays * (assignment.allocationPercent / 100);
    }, 0);
}

/** Total biaya proyek dihitung dari tugas daun. */
export function computeCosts(input: {
  tasks: CostTask[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
}): CostBreakdown {
  const { tasks, resources, assignments } = input;
  const leaves = new Set(leafTaskIds(tasks));
  const leafTasks = tasks.filter((task) => leaves.has(task.id));
  const byTask: Record<string, number> = {};
  let total = 0;
  for (const task of leafTasks) {
    const cost = Math.round(taskCost(task, resources, assignments));
    byTask[task.id] = cost;
    total += cost;
  }

  const byResource: Record<string, number> = {};
  for (const resource of resources) {
    const cost = assignments
      .filter((assignment) => assignment.resourceId === resource.id)
      .filter((assignment) => leaves.has(assignment.taskId))
      .reduce((sum, assignment) => {
        const task = leafTasks.find((item) => item.id === assignment.taskId);
        if (!task) return sum;
        return (
          sum + dailyRate(resource.salary) * task.durationDays * (assignment.allocationPercent / 100)
        );
      }, 0);
    byResource[resource.id] = Math.round(cost);
  }

  return { total, byTask, byResource };
}

/**
 * Deteksi over-alokasi: total allocationPercent seorang resource pada tugas daun
 * yang tumpang tindih melebihi 100% pada satu hari kerja.
 */
export function computeResourceLoad(input: {
  tasks: CostTask[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  calendar: ProjectCalendar;
}): ResourceLoad[] {
  const { tasks, resources, assignments, calendar } = input;
  const leaves = new Set(leafTaskIds(tasks));
  const leafTasks = new Map(tasks.filter((task) => leaves.has(task.id)).map((task) => [task.id, task]));

  return resources.map((resource) => {
    const perDay = new Map<string, number>();
    for (const assignment of assignments) {
      if (assignment.resourceId !== resource.id) continue;
      const task = leafTasks.get(assignment.taskId);
      if (!task) continue;
      const days = workingDaysInRange(
        parseDate(task.scheduledStart),
        parseDate(task.scheduledEnd),
        calendar,
      );
      for (const day of days) {
        const key = formatDate(day);
        perDay.set(key, (perDay.get(key) ?? 0) + assignment.allocationPercent);
      }
    }
    const overAllocationDays = [...perDay.entries()]
      .filter(([, totalPercent]) => totalPercent > 100)
      .map(([date, totalPercent]) => ({ date, totalPercent }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { resourceId: resource.id, name: resource.name, overAllocationDays };
  });
}
