import { describe, expect, it } from "vitest";
import {
  buildPert,
  computeCpm,
  computeCosts,
  computeResourceLoad,
  createCalendar,
  dailyRate,
  formatDate,
  isWorkingDay,
  nextWorkingDay,
  parseDate,
  pertEstimate,
  scheduleProject,
  shiftWorkingDays,
  validateWeekendDays,
  workingDaysBetween,
  workingDayOrdinal,
  type AssignmentDto,
  type ResourceDto,
  type SchedulingDependency,
  type SchedulingTask,
} from "./index.js";

const weekend = createCalendar([0, 6]);
const withHoliday = createCalendar([0, 6], ["2026-10-26"]);

function day(value: string): Date {
  return parseDate(value);
}

function task(overrides: Partial<SchedulingTask> & { id: string }): SchedulingTask {
  return {
    parentId: null,
    durationDays: 1,
    startDate: "2026-10-19",
    progress: 0,
    ...overrides,
  };
}

const fs = (predecessorId: string, successorId: string, lagDays = 0): SchedulingDependency => ({
  predecessorId,
  successorId,
  type: "FS",
  lagDays,
});

const ss = (predecessorId: string, successorId: string, lagDays = 0): SchedulingDependency => ({
  predecessorId,
  successorId,
  type: "SS",
  lagDays,
});

function schedule(
  tasks: SchedulingTask[],
  dependencies: SchedulingDependency[] = [],
  calendar = weekend,
) {
  return scheduleProject(tasks, dependencies, calendar);
}

describe("kalender", () => {
  it("mengenali hari kerja dan hari libur", () => {
    expect(isWorkingDay(day("2026-10-23"), weekend)).toBe(true);
    expect(isWorkingDay(day("2026-10-24"), weekend)).toBe(false);
    expect(isWorkingDay(day("2026-10-25"), weekend)).toBe(false);
    expect(isWorkingDay(day("2026-10-26"), withHoliday)).toBe(false);
  });

  it("memajukan ke hari kerja berikutnya", () => {
    expect(formatDate(nextWorkingDay(day("2026-10-24"), weekend))).toBe("2026-10-26");
    expect(formatDate(nextWorkingDay(day("2026-10-26"), weekend))).toBe("2026-10-26");
    expect(formatDate(nextWorkingDay(day("2026-10-25"), withHoliday))).toBe("2026-10-27");
  });

  it("menggeser sejumlah hari kerja termasuk negatif", () => {
    expect(formatDate(shiftWorkingDays(day("2026-10-23"), 1, weekend))).toBe("2026-10-26");
    expect(formatDate(shiftWorkingDays(day("2026-10-27"), -1, weekend))).toBe("2026-10-26");
    expect(formatDate(shiftWorkingDays(day("2026-10-26"), -1, weekend))).toBe("2026-10-23");
    expect(formatDate(shiftWorkingDays(day("2026-10-23"), 0, weekend))).toBe("2026-10-23");
  });

  it("menghitung hari kerja inklusif", () => {
    expect(workingDaysBetween(day("2026-10-19"), day("2026-10-23"), weekend)).toBe(5);
    expect(workingDaysBetween(day("2026-10-23"), day("2026-10-27"), weekend)).toBe(3);
    expect(workingDaysBetween(day("2026-10-23"), day("2026-10-28"), withHoliday)).toBe(3);
  });

  it("menghitung ordinal hari kerja dari awal proyek", () => {
    expect(workingDayOrdinal(day("2026-10-19"), day("2026-10-19"), weekend)).toBe(0);
    expect(workingDayOrdinal(day("2026-10-19"), day("2026-10-23"), weekend)).toBe(4);
    expect(workingDayOrdinal(day("2026-10-19"), day("2026-10-26"), weekend)).toBe(5);
  });

  it("menolak akhir pekan yang berisi semua hari", () => {
    expect(validateWeekendDays([0, 1, 2, 3, 4, 5, 6])).not.toBeNull();
    expect(validateWeekendDays([0, 6])).toBeNull();
  });
});

describe("vektor uji wajib 6.11", () => {
  it("durasi 3 hari dari Jumat berakhir Selasa", () => {
    const result = schedule([task({ id: "a", startDate: "2026-10-23", durationDays: 3 })]);
    const values = result.get("a");
    expect(values?.scheduledEnd).toBe("2026-10-27");
  });

  it("FS lag 0 memulai penerus pada Rabu", () => {
    const result = schedule(
      [
        task({ id: "a", startDate: "2026-10-23", durationDays: 3 }),
        task({ id: "b", startDate: "2026-10-01", durationDays: 2 }),
      ],
      [fs("a", "b")],
    );
    expect(result.get("b")?.scheduledStart).toBe("2026-10-28");
  });

  it("SS lag 2 memulai penerus pada Selasa", () => {
    const result = schedule(
      [
        task({ id: "a", startDate: "2026-10-23", durationDays: 3 }),
        task({ id: "b", startDate: "2026-10-01", durationDays: 2 }),
      ],
      [ss("a", "b", 2)],
    );
    expect(result.get("b")?.scheduledStart).toBe("2026-10-27");
  });

  it("hari libur menggeser akhir tugas", () => {
    const result = schedule(
      [task({ id: "a", startDate: "2026-10-23", durationDays: 3 })],
      [],
      withHoliday,
    );
    expect(result.get("a")?.scheduledEnd).toBe("2026-10-28");
  });

  it("CPM: A, C, D kritis; B float 3; PE = 8", () => {
    const tasks: SchedulingTask[] = [
      task({ id: "a", startDate: "2026-10-19", durationDays: 3 }),
      task({ id: "b", startDate: "2026-10-19", durationDays: 2 }),
      task({ id: "c", startDate: "2026-10-19", durationDays: 5 }),
      task({ id: "d", startDate: "2026-10-19", durationDays: 1 }),
    ];
    const dependencies = [fs("a", "b"), fs("a", "c"), fs("b", "d"), fs("c", "d")];
    const scheduled = schedule(tasks, dependencies);
    const tasksWithSchedule = tasks.map((item) => ({
      ...item,
      scheduledStart: scheduled.get(item.id)?.scheduledStart as string,
      scheduledEnd: scheduled.get(item.id)?.scheduledEnd as string,
    }));
    const cpm = computeCpm({
      tasks: tasksWithSchedule,
      taskNames: { a: "A", b: "B", c: "C", d: "D" },
      dependencies,
      projectStartDate: "2026-10-19",
      calendar: weekend,
    });

    expect(cpm.projectEnd).toBe(8);
    const byId = new Map(cpm.nodes.map((node) => [node.taskId, node]));
    expect(byId.get("a")?.critical).toBe(true);
    expect(byId.get("c")?.critical).toBe(true);
    expect(byId.get("d")?.critical).toBe(true);
    expect(byId.get("b")?.critical).toBe(false);
    expect(byId.get("b")?.totalFloat).toBe(3);
    expect(cpm.criticalPath).toEqual(["a", "c", "d"]);
  });
});

describe("dependensi", () => {
  it("menghormati startDate sebagai batas paling awal", () => {
    const result = schedule(
      [task({ id: "a", startDate: "2026-10-19", durationDays: 1 }), task({ id: "b", startDate: "2026-11-02", durationDays: 1 })],
      [fs("a", "b")],
    );
    expect(result.get("b")?.scheduledStart).toBe("2026-11-02");
  });

  it("mendukung lag negatif", () => {
    const result = schedule(
      [task({ id: "a", startDate: "2026-10-19", durationDays: 5 }), task({ id: "b", startDate: "2026-10-19", durationDays: 1 })],
      [fs("a", "b", -2)],
    );
    expect(result.get("a")?.scheduledEnd).toBe("2026-10-23");
    expect(result.get("b")?.scheduledStart).toBe("2026-10-22");
  });

  it("menggeser tugas saat hari libur ditambahkan", () => {
    const tasks = [task({ id: "a", startDate: "2026-10-19", durationDays: 10 })];
    const before = schedule(tasks);
    const after = schedule(tasks, [], withHoliday);
    expect(before.get("a")?.scheduledEnd).toBe("2026-10-30");
    expect(after.get("a")?.scheduledEnd).toBe("2026-11-02");
  });
});

describe("tugas induk", () => {
  it("menghitung rentang, durasi, dan progres dari anak", () => {
    const tasks: SchedulingTask[] = [
      task({ id: "p", durationDays: 1, startDate: "2026-10-19" }),
      task({ id: "c1", parentId: "p", startDate: "2026-10-19", durationDays: 2, progress: 100 }),
      task({ id: "c2", parentId: "p", startDate: "2026-10-26", durationDays: 4, progress: 0 }),
    ];
    const result = schedule(tasks);
    expect(result.get("p")?.scheduledStart).toBe("2026-10-19");
    expect(result.get("p")?.scheduledEnd).toBe("2026-10-29");
    expect(result.get("p")?.durationDays).toBe(9);
    expect(result.get("p")?.progress).toBe(33);
  });

  it("mengabaikan tugas induk saat menjadwalkan dependensi", () => {
    const tasks: SchedulingTask[] = [
      task({ id: "p" }),
      task({ id: "c1", parentId: "p", startDate: "2026-10-19", durationDays: 2 }),
      task({ id: "x", startDate: "2026-10-05", durationDays: 1 }),
    ];
    const result = schedule(tasks, [fs("p", "x")]);
    expect(result.get("x")?.scheduledStart).toBe("2026-10-05");
  });
});

describe("PERT dan biaya", () => {
  it("menghitung te dan variansi", () => {
    const { te, variance } = pertEstimate(8, 10, 15);
    expect(te).toBeCloseTo(10.5, 5);
    expect(variance).toBeCloseTo(49 / 36, 5);
  });

  it("menandai node dan panah kritis serta total variansi jalur kritis", () => {
    const tasks: SchedulingTask[] = [
      task({ id: "a", startDate: "2026-10-19", durationDays: 3 }),
      task({ id: "b", startDate: "2026-10-19", durationDays: 2 }),
      task({ id: "c", startDate: "2026-10-19", durationDays: 5 }),
      task({ id: "d", startDate: "2026-10-19", durationDays: 1 }),
    ];
    const dependencies = [fs("a", "b"), fs("a", "c"), fs("b", "d"), fs("c", "d")];
    const scheduled = schedule(tasks, dependencies);
    const withSchedule = tasks.map((item) => ({
      ...item,
      scheduledStart: scheduled.get(item.id)?.scheduledStart as string,
      scheduledEnd: scheduled.get(item.id)?.scheduledEnd as string,
    }));
    const cpm = computeCpm({
      tasks: withSchedule,
      taskNames: { a: "A", b: "B", c: "C", d: "D" },
      dependencies,
      projectStartDate: "2026-10-19",
      calendar: weekend,
    });
    const pert = buildPert({
      tasks: withSchedule,
      cpmNodes: cpm.nodes,
      criticalPath: cpm.criticalPath,
      dependencies,
      estimates: { c: { optimisticDays: 4, pessimisticDays: 8 }, d: { optimisticDays: 1, pessimisticDays: 2 } },
    });
    const nodeC = pert.nodes.find((node) => node.taskId === "c");
    expect(nodeC?.critical).toBe(true);
    expect(nodeC?.te).toBeCloseTo(5.33, 2);
    expect(nodeC?.column).toBe(1);
    expect(pert.edges.filter((edge) => edge.critical).length).toBe(2);
    expect(pert.criticalStdDev).toBeGreaterThan(0);
  });

  it("menghitung biaya tugas dan mendeteksi over-alokasi", () => {
    const resources: ResourceDto[] = [
      { id: "r1", projectId: "p", name: "Budi", email: "budi@example.com", role: "Dev", salary: 11_000_000 },
    ];
    const tasks = [
      {
        ...task({ id: "t1", startDate: "2026-10-19", durationDays: 5 }),
        scheduledStart: "2026-10-19",
        scheduledEnd: "2026-10-23",
      },
      {
        ...task({ id: "t2", startDate: "2026-10-20", durationDays: 5 }),
        scheduledStart: "2026-10-20",
        scheduledEnd: "2026-10-26",
      },
    ];
    const assignments: AssignmentDto[] = [
      { id: "a1", taskId: "t1", resourceId: "r1", allocationPercent: 80 },
      { id: "a2", taskId: "t2", resourceId: "r1", allocationPercent: 60 },
    ];
    const costs = computeCosts({ tasks, resources, assignments });
    expect(dailyRate(11_000_000)).toBe(500_000);
    expect(costs.byTask.t1).toBe(2_000_000);
    expect(costs.total).toBe(3_500_000);

    const loads = computeResourceLoad({ tasks, resources, assignments, calendar: weekend });
    expect(loads[0].overAllocationDays.length).toBe(4);
    expect(loads[0].overAllocationDays[0]).toEqual({ date: "2026-10-20", totalPercent: 140 });
  });
});

describe("skema validasi", () => {
  it("menerima lag negatif dan menolak tipe dependensi asing", async () => {
    const { dependencyCreateSchema } = await import("./schemas.js");
    const parsed = dependencyCreateSchema.safeParse({ predecessorId: "a", type: "FS", lagDays: -3 });
    expect(parsed.success).toBe(true);
    const invalid = dependencyCreateSchema.safeParse({ predecessorId: "a", type: "XX", lagDays: 0 });
    expect(invalid.success).toBe(false);
  });

  it("menolak tanggal yang tidak nyata", async () => {
    const { dateStringSchema } = await import("./schemas.js");
    expect(dateStringSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateStringSchema.safeParse("2026-02-28").success).toBe(true);
  });
});
