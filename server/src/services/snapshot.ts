import type {
  Assignment,
  Dependency,
  Holiday,
  Project,
  Resource,
  Task,
} from "@prisma/client";
import {
  type AssignmentDto,
  type DependencyDto,
  type DependencyType,
  type HolidayDto,
  type Priority,
  type ProjectDto,
  type ProjectSnapshot,
  type ResourceDto,
  type TaskDto,
} from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";

export function serializeProject(project: Project): ProjectDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    weekendDays: project.weekendDays,
    createdAt: project.createdAt.toISOString(),
  };
}

export function serializeTask(task: Task): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: task.description,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: task.priority as Priority,
    color: task.color,
    progress: task.progress,
    optimisticDays: task.optimisticDays,
    pessimisticDays: task.pessimisticDays,
  };
}

export function serializeDependency(dependency: Dependency): DependencyDto {
  return {
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type as DependencyType,
    lagDays: dependency.lagDays,
  };
}

export function serializeResource(resource: Resource): ResourceDto {
  return {
    id: resource.id,
    projectId: resource.projectId,
    name: resource.name,
    email: resource.email,
    role: resource.role,
    salary: resource.salary,
  };
}

export function serializeAssignment(assignment: Assignment): AssignmentDto {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  };
}

export function serializeHoliday(holiday: Holiday): HolidayDto {
  return {
    id: holiday.id,
    projectId: holiday.projectId,
    date: holiday.date,
    name: holiday.name,
  };
}

/** Urutan tampilan: kedalaman pohon lalu posisi antar saudara. */
export function sortTasks(tasks: Task[]): TaskDto[] {
  const byParent = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const list = byParent.get(task.parentId) ?? [];
    list.push(task);
    byParent.set(task.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  const ordered: TaskDto[] = [];
  const walk = (parentId: string | null): void => {
    for (const task of byParent.get(parentId) ?? []) {
      ordered.push(serializeTask(task));
      walk(task.id);
    }
  };
  walk(null);
  const seen = new Set(ordered.map((task) => task.id));
  for (const task of tasks) {
    if (!seen.has(task.id)) ordered.push(serializeTask(task));
  }
  return ordered;
}

export async function listTasks(projectId: string): Promise<TaskDto[]> {
  const tasks = await prisma.task.findMany({ where: { projectId } });
  return sortTasks(tasks);
}

export async function getOwnedProject(projectId: string, ownerId: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Proyek tidak ditemukan.");
  }
  return project;
}

export async function getOwnedTask(
  taskId: string,
  ownerId: string,
): Promise<{ task: Task; project: Project }> {
  const found = await prisma.task.findFirst({
    where: { id: taskId, project: { ownerId } },
    include: { project: true },
  });
  if (!found) {
    throw new AppError(404, "TASK_NOT_FOUND", "Tugas tidak ditemukan.");
  }
  const { project, ...task } = found;
  return { task, project };
}

export async function getOwnedResource(resourceId: string, ownerId: string): Promise<Resource> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, project: { ownerId } },
  });
  if (!resource) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Anggota tim tidak ditemukan.");
  }
  return resource;
}

export async function getOwnedDependency(
  dependencyId: string,
  ownerId: string,
): Promise<{ dependency: Dependency; project: Project }> {
  const found = await prisma.dependency.findFirst({
    where: { id: dependencyId, successor: { project: { ownerId } } },
    include: { successor: { include: { project: true } } },
  });
  if (!found) {
    throw new AppError(404, "DEPENDENCY_NOT_FOUND", "Dependensi tidak ditemukan.");
  }
  const { successor, ...dependency } = found;
  return { dependency, project: successor.project };
}

export async function getOwnedAssignment(
  assignmentId: string,
  ownerId: string,
): Promise<{ assignment: Assignment; project: Project }> {
  const found = await prisma.assignment.findFirst({
    where: { id: assignmentId, task: { project: { ownerId } } },
    include: { task: { include: { project: true } } },
  });
  if (!found) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Alokasi tidak ditemukan.");
  }
  const { task, ...assignment } = found;
  return { assignment, project: task.project };
}

export async function getOwnedHoliday(
  holidayId: string,
  ownerId: string,
): Promise<{ holiday: Holiday; project: Project }> {
  const found = await prisma.holiday.findFirst({
    where: { id: holidayId, project: { ownerId } },
    include: { project: true },
  });
  if (!found) {
    throw new AppError(404, "HOLIDAY_NOT_FOUND", "Hari libur tidak ditemukan.");
  }
  const { project, ...holiday } = found;
  return { holiday, project };
}

export async function getSnapshot(projectId: string, ownerId: string): Promise<ProjectSnapshot> {
  const project = await getOwnedProject(projectId, ownerId);
  const [tasks, dependencies, resources, assignments, holidays] = await Promise.all([
    prisma.task.findMany({ where: { projectId } }),
    prisma.dependency.findMany({ where: { predecessor: { projectId } } }),
    prisma.resource.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({ where: { task: { projectId } } }),
    prisma.holiday.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
  ]);

  return {
    project: serializeProject(project),
    tasks: sortTasks(tasks),
    dependencies: dependencies.map(serializeDependency),
    resources: resources.map(serializeResource),
    assignments: assignments.map(serializeAssignment),
    holidays: holidays.map(serializeHoliday),
  };
}
