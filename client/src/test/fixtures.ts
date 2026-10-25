import type {
  AssignmentDto,
  DependencyDto,
  HolidayDto,
  ProjectDto,
  ProjectSnapshot,
  ResourceDto,
  TaskDto,
} from "shared";

/** Cuplikan data sejenis seed: proyek, tugas induk dengan dua anak, dependensi FS, dan anggota tim. */
export function seedSnapshot(): ProjectSnapshot {
  const project: ProjectDto = {
    id: "proj-1",
    ownerId: "user-1",
    name: "Pengembangan Aplikasi Mobile Toko Online",
    description: null,
    startDate: "2026-10-19",
    weekendDays: "0,6",
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  const tasks: TaskDto[] = [
    {
      id: "task-1",
      projectId: "proj-1",
      parentId: null,
      position: 0,
      name: "1 Perencanaan",
      description: null,
      durationDays: 4,
      startDate: "2026-10-19",
      scheduledStart: "2026-10-19",
      scheduledEnd: "2026-10-22",
      priority: "HIGH",
      color: "#2563EB",
      progress: 80,
      optimisticDays: null,
      pessimisticDays: null,
    },
    {
      id: "task-1-1",
      projectId: "proj-1",
      parentId: "task-1",
      position: 0,
      name: "Kickoff dan kebutuhan",
      description: null,
      durationDays: 3,
      startDate: "2026-10-19",
      scheduledStart: "2026-10-19",
      scheduledEnd: "2026-10-21",
      priority: "HIGH",
      color: "#2563EB",
      progress: 100,
      optimisticDays: null,
      pessimisticDays: null,
    },
    {
      id: "task-1-2",
      projectId: "proj-1",
      parentId: "task-1",
      position: 1,
      name: "Penyusunan spesifikasi",
      description: null,
      durationDays: 4,
      startDate: "2026-10-22",
      scheduledStart: "2026-10-22",
      scheduledEnd: "2026-10-27",
      priority: "HIGH",
      color: "#2563EB",
      progress: 60,
      optimisticDays: null,
      pessimisticDays: null,
    },
    {
      id: "task-2",
      projectId: "proj-1",
      parentId: null,
      position: 1,
      name: "2 Desain",
      description: null,
      durationDays: 5,
      startDate: "2026-10-28",
      scheduledStart: "2026-10-28",
      scheduledEnd: "2026-11-03",
      priority: "MEDIUM",
      color: "#7C3AED",
      progress: 20,
      optimisticDays: null,
      pessimisticDays: null,
    },
    {
      id: "task-2-1",
      projectId: "proj-1",
      parentId: "task-2",
      position: 0,
      name: "Riset dan wireframe",
      description: null,
      durationDays: 5,
      startDate: "2026-10-28",
      scheduledStart: "2026-10-28",
      scheduledEnd: "2026-11-03",
      priority: "MEDIUM",
      color: "#7C3AED",
      progress: 20,
      optimisticDays: null,
      pessimisticDays: null,
    },
  ];

  const dependencies: DependencyDto[] = [
    {
      id: "dep-1",
      predecessorId: "task-1-1",
      successorId: "task-1-2",
      type: "FS",
      lagDays: 0,
    },
    {
      id: "dep-2",
      predecessorId: "task-1-2",
      successorId: "task-2-1",
      type: "SS",
      lagDays: 2,
    },
  ];

  const resources: ResourceDto[] = [
    {
      id: "res-1",
      projectId: "proj-1",
      name: "Andi Pratama",
      email: "andi@example.com",
      role: "Project Manager",
      salary: 15_000_000,
    },
  ];

  const assignments: AssignmentDto[] = [
    { id: "asg-1", taskId: "task-1-1", resourceId: "res-1", allocationPercent: 100 },
  ];

  const holidays: HolidayDto[] = [
    { id: "hol-1", projectId: "proj-1", date: "2026-11-11", name: "Libur internal (contoh)" },
  ];

  return { project, tasks, dependencies, resources, assignments, holidays };
}
