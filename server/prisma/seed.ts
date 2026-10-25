import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  createCalendar,
  parseWeekendDays,
  scheduleProject,
  type SchedulingDependency,
} from "shared";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "Demo12345";
const PROJECT_NAME = "Pengembangan Aplikasi Mobile Toko Online";
const PROJECT_START = "2026-10-19";
const START = PROJECT_START;

interface SeedTask {
  key: string;
  parentKey?: string;
  name: string;
  durationDays: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  color: string;
  progress: number;
  resource?: string;
  secondResource?: string;
  optimisticDays?: number;
  pessimisticDays?: number;
}

const tasks: SeedTask[] = [
  { key: "1", name: "Perencanaan", durationDays: 1, priority: "HIGH", color: "#2563EB", progress: 0 },
  { key: "1.1", parentKey: "1", name: "Kickoff dan kebutuhan", durationDays: 3, priority: "HIGH", color: "#2563EB", progress: 100, resource: "Andi" },
  { key: "1.2", parentKey: "1", name: "Penyusunan spesifikasi", durationDays: 4, priority: "HIGH", color: "#2563EB", progress: 60, resource: "Andi" },

  { key: "2", name: "Desain", durationDays: 1, priority: "MEDIUM", color: "#7C3AED", progress: 0 },
  { key: "2.1", parentKey: "2", name: "Riset dan wireframe", durationDays: 5, priority: "MEDIUM", color: "#7C3AED", progress: 0, resource: "Citra" },
  { key: "2.2", parentKey: "2", name: "Desain UI high-fidelity", durationDays: 6, priority: "MEDIUM", color: "#7C3AED", progress: 0, resource: "Citra" },

  { key: "3", name: "Pengembangan", durationDays: 1, priority: "HIGH", color: "#0D9488", progress: 0 },
  { key: "3.1", parentKey: "3", name: "Rancang database dan API", durationDays: 5, priority: "HIGH", color: "#0D9488", progress: 0, resource: "Budi" },
  { key: "3.2", parentKey: "3", name: "Implementasi backend", durationDays: 10, priority: "HIGH", color: "#0D9488", progress: 0, resource: "Budi", optimisticDays: 8, pessimisticDays: 15 },
  { key: "3.3", parentKey: "3", name: "Implementasi frontend mobile", durationDays: 12, priority: "HIGH", color: "#0D9488", progress: 0, resource: "Budi", secondResource: "Citra" },

  { key: "4", name: "Pengujian", durationDays: 1, priority: "MEDIUM", color: "#D97706", progress: 0 },
  { key: "4.1", parentKey: "4", name: "Skenario uji", durationDays: 3, priority: "MEDIUM", color: "#D97706", progress: 0, resource: "Dewi" },
  { key: "4.2", parentKey: "4", name: "Integrasi dan uji sistem", durationDays: 6, priority: "HIGH", color: "#D97706", progress: 0, resource: "Dewi" },
  { key: "4.3", parentKey: "4", name: "Perbaikan bug", durationDays: 4, priority: "MEDIUM", color: "#D97706", progress: 0, resource: "Budi" },

  { key: "5", name: "Peluncuran", durationDays: 1, priority: "MEDIUM", color: "#DB2777", progress: 0 },
  { key: "5.1", parentKey: "5", name: "Persiapan rilis", durationDays: 2, priority: "MEDIUM", color: "#DB2777", progress: 0, resource: "Andi" },
  { key: "5.2", parentKey: "5", name: "Rilis dan serah terima", durationDays: 1, priority: "HIGH", color: "#DB2777", progress: 0, resource: "Andi" },
];

const dependencies: { from: string; to: string; type: "FS" | "SS"; lag: number }[] = [
  { from: "1.1", to: "1.2", type: "FS", lag: 0 },
  { from: "1.2", to: "2.1", type: "SS", lag: 2 },
  { from: "2.1", to: "2.2", type: "FS", lag: 0 },
  { from: "1.2", to: "3.1", type: "FS", lag: 0 },
  { from: "3.1", to: "3.2", type: "FS", lag: 0 },
  { from: "2.2", to: "3.3", type: "FS", lag: 0 },
  { from: "3.2", to: "3.3", type: "SS", lag: 3 },
  { from: "3.2", to: "4.1", type: "SS", lag: 4 },
  { from: "3.2", to: "4.2", type: "FS", lag: 0 },
  { from: "3.3", to: "4.2", type: "FS", lag: 0 },
  { from: "4.2", to: "4.3", type: "FS", lag: 0 },
  { from: "4.3", to: "5.1", type: "FS", lag: 1 },
  { from: "5.1", to: "5.2", type: "FS", lag: 0 },
];

const resources = [
  { key: "Andi", name: "Andi Pratama", email: "andi.pratama@example.com", role: "Project Manager", salary: 15_000_000 },
  { key: "Budi", name: "Budi Santoso", email: "budi.santoso@example.com", role: "Backend Developer", salary: 12_000_000 },
  { key: "Citra", name: "Citra Lestari", email: "citra.lestari@example.com", role: "UI/UX Designer", salary: 10_000_000 },
  { key: "Dewi", name: "Dewi Anggraini", email: "dewi.anggraini@example.com", role: "QA Engineer", salary: 9_000_000 },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo Pengguna", passwordHash },
    create: { name: "Demo Pengguna", email: DEMO_EMAIL, passwordHash },
  });

  const existing = await prisma.project.findFirst({
    where: { ownerId: user.id, name: PROJECT_NAME },
  });
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } });
  }

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: PROJECT_NAME,
      description:
        "Proyek contoh pengembangan aplikasi mobile toko online, dari perencanaan sampai peluncuran.",
      startDate: PROJECT_START,
      weekendDays: "0,6",
      holidays: {
        create: [
          { date: "2026-11-11", name: "Libur internal (contoh)" },
          { date: "2026-12-25", name: "Hari Raya Natal" },
        ],
      },
      resources: { create: resources.map(({ name, email, role, salary }) => ({ name, email, role, salary })) },
    },
    include: { resources: true, holidays: true },
  });

  const resourceIdByKey = new Map(
    project.resources.map((resource) => [resource.name.split(" ")[0], resource.id]),
  );

  const taskIdByKey = new Map<string, string>();
  for (const seedTask of tasks) {
    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId: seedTask.parentKey ? (taskIdByKey.get(seedTask.parentKey) as string) : null,
        position: Number(seedTask.key.split(".").pop()),
        name: seedTask.name,
        durationDays: seedTask.durationDays,
        startDate: START,
        scheduledStart: START,
        scheduledEnd: START,
        priority: seedTask.priority,
        color: seedTask.color,
        progress: seedTask.progress,
        optimisticDays: seedTask.optimisticDays ?? null,
        pessimisticDays: seedTask.pessimisticDays ?? null,
      },
    });
    taskIdByKey.set(seedTask.key, created.id);
  }

  for (const dependency of dependencies) {
    await prisma.dependency.create({
      data: {
        predecessorId: taskIdByKey.get(dependency.from) as string,
        successorId: taskIdByKey.get(dependency.to) as string,
        type: dependency.type,
        lagDays: dependency.lag,
      },
    });
  }

  for (const seedTask of tasks) {
    if (!seedTask.resource) continue;
    const taskId = taskIdByKey.get(seedTask.key) as string;
    const primaryId = resourceIdByKey.get(seedTask.resource) as string;
    await prisma.assignment.create({
      data: {
        taskId,
        resourceId: primaryId,
        allocationPercent: seedTask.secondResource ? 50 : 100,
      },
    });
    if (seedTask.secondResource) {
      await prisma.assignment.create({
        data: {
          taskId,
          resourceId: resourceIdByKey.get(seedTask.secondResource) as string,
          allocationPercent: 50,
        },
      });
    }
  }

  const allTasks = await prisma.task.findMany({ where: { projectId: project.id } });
  const allDependencies = await prisma.dependency.findMany({
    where: { predecessor: { projectId: project.id } },
  });
  const calendar = createCalendar(
    parseWeekendDays(project.weekendDays),
    project.holidays.map((holiday) => holiday.date),
  );
  const scheduled = scheduleProject(
    allTasks.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
    })),
    allDependencies.map(
      (dependency): SchedulingDependency => ({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type === "SS" ? "SS" : "FS",
        lagDays: dependency.lagDays,
      }),
    ),
    calendar,
  );

  const scheduleUpdates = allTasks
    .map((task) => {
      const values = scheduled.get(task.id);
      if (!values) return null;
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

  if (scheduleUpdates.length > 0) {
    await prisma.$transaction(scheduleUpdates);
  }

  console.log(`Seed selesai. Akun demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (proyek: ${project.name})`);
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
