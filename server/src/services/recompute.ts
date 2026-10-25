import {
  createCalendar,
  parseWeekendDays,
  scheduleProject,
  type SchedulingDependency,
  type TaskDto,
} from "shared";
import type { Task } from "@prisma/client";
import { prisma } from "../db.js";
import { listTasks } from "./snapshot.js";

/**
 * Menghitung ulang seluruh jadwal proyek memakai mesin `shared`,
 * menyimpannya, lalu mengembalikan seluruh tugas terbaru.
 */
export async function recomputeProject(projectId: string): Promise<TaskDto[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { holidays: true },
  });
  if (!project) {
    throw new Error(`Proyek ${projectId} tidak ditemukan saat menghitung ulang jadwal.`);
  }

  const tasks = await prisma.task.findMany({ where: { projectId } });
  if (tasks.length === 0) return [];

  const dependencies = await prisma.dependency.findMany({
    where: { predecessor: { projectId } },
  });
  const calendar = createCalendar(
    parseWeekendDays(project.weekendDays),
    project.holidays.map((holiday) => holiday.date),
  );

  const schedulingDeps: SchedulingDependency[] = dependencies.map((dependency) => ({
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type === "SS" ? "SS" : "FS",
    lagDays: dependency.lagDays,
  }));

  const scheduled = scheduleProject(
    tasks.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
    })),
    schedulingDeps,
    calendar,
  );

  const updates = tasks
    .map((task) => {
      const values = scheduled.get(task.id);
      if (!values) return null;
      if (
        values.scheduledStart === task.scheduledStart &&
        values.scheduledEnd === task.scheduledEnd &&
        values.durationDays === task.durationDays &&
        values.progress === task.progress
      ) {
        return null;
      }
      return prisma.task.update({
        where: { id: task.id },
        data: {
          scheduledStart: values.scheduledStart,
          scheduledEnd: values.scheduledEnd,
          durationDays: values.durationDays,
          progress: values.progress,
        },
      });
    })
    .filter((update): update is NonNullable<typeof update> => update !== null);

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return listTasks(projectId);
}

/** Semua id keturunan (anak, cucu, ...) dari sebuah tugas. */
export function descendantIds(tasks: Pick<Task, "id" | "parentId">[], taskId: string): string[] {
  const result: string[] = [];
  const collect = (parentId: string): void => {
    for (const task of tasks) {
      if (task.parentId === parentId) {
        result.push(task.id);
        collect(task.id);
      }
    }
  };
  collect(taskId);
  return result;
}

/** Kedalaman sebuah tugas di pohon (root = 1). */
export function taskDepth(tasks: Pick<Task, "id" | "parentId">[], taskId: string): number {
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

/** Apakah menambahkan edge predecessor -> successor membentuk siklus. */
export function wouldCreateCycle(
  edges: { predecessorId: string; successorId: string }[],
  predecessorId: string,
  successorId: string,
): boolean {
  if (predecessorId === successorId) return true;
  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    const list = successors.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    successors.set(edge.predecessorId, list);
  }
  const stack = [successorId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === predecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(successors.get(current) ?? []));
  }
  return false;
}
