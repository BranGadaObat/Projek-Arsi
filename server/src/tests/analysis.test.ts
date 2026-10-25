import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";
import {
  PROJECT_START,
  bearer,
  createProject,
  createTask,
  findTask,
  registerUser,
  resetDb,
} from "./helpers.js";

let app: Express;
let token: string;
let projectId: string;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  const user = await registerUser(app);
  token = user.token;
  const project = await createProject(app, token);
  projectId = project.id as string;
});

async function createResource(payload: Record<string, unknown> = {}) {
  const response = await request(app)
    .post(`/api/projects/${projectId}/resources`)
    .set(bearer(token))
    .send({
      name: "Budi Santoso",
      email: "budi@example.com",
      role: "Backend Developer",
      salary: 11_000_000,
      ...payload,
    });
  expect(response.status).toBe(201);
  return response.body.resource as Record<string, unknown>;
}

describe("resource dan alokasi", () => {
  it("menambah, mengubah, dan menghapus anggota tim", async () => {
    const resource = await createResource();
    expect(resource).toMatchObject({ name: "Budi Santoso", salary: 11_000_000 });

    const patched = await request(app)
      .patch(`/api/resources/${resource.id}`)
      .set(bearer(token))
      .send({ role: "Tech Lead", salary: 14_000_000 });
    expect(patched.status).toBe(200);
    expect(patched.body.resource).toMatchObject({ role: "Tech Lead", salary: 14_000_000 });

    const list = await request(app)
      .get(`/api/projects/${projectId}/resources`)
      .set(bearer(token));
    expect(list.body.resources).toHaveLength(1);

    const removed = await request(app)
      .delete(`/api/resources/${resource.id}`)
      .set(bearer(token));
    expect(removed.status).toBe(200);
  });

  it("menolak alokasi ganda dan alokasi pada tugas induk", async () => {
    const resource = await createResource();
    const task = await createTask(app, token, projectId, { name: "Tugas" });
    const first = await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(bearer(token))
      .send({ resourceId: resource.id, allocationPercent: 80 });
    expect(first.status).toBe(201);
    expect(first.body.assignment.allocationPercent).toBe(80);

    const duplicate = await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(bearer(token))
      .send({ resourceId: resource.id, allocationPercent: 50 });
    expect(duplicate.status).toBe(409);

    const parent = await createTask(app, token, projectId, { name: "Induk" });
    await createTask(app, token, projectId, { name: "Anak", parentId: parent.id as string });
    const parentAssignment = await request(app)
      .post(`/api/tasks/${parent.id}/assignments`)
      .set(bearer(token))
      .send({ resourceId: resource.id, allocationPercent: 100 });
    expect(parentAssignment.status).toBe(422);
    expect(parentAssignment.body.error.code).toBe("PARENT_TASK_ASSIGNMENT");
  });

  it("menghitung biaya dan peringatan over-alokasi", async () => {
    const resource = await createResource();
    const first = await createTask(app, token, projectId, {
      name: "Tugas 1",
      durationDays: 5,
      startDate: PROJECT_START,
    });
    const second = await createTask(app, token, projectId, {
      name: "Tugas 2",
      durationDays: 5,
      startDate: PROJECT_START,
    });
    for (const task of [first, second]) {
      const assignment = await request(app)
        .post(`/api/tasks/${task.id}/assignments`)
        .set(bearer(token))
        .send({ resourceId: resource.id, allocationPercent: 60 });
      expect(assignment.status).toBe(201);
    }

    const analysis = await request(app)
      .get(`/api/projects/${projectId}/analysis`)
      .set(bearer(token));

    expect(analysis.status).toBe(200);
    expect(analysis.body.summary.totalCost).toBe(3_000_000);
    expect(analysis.body.cost.byTask[first.id as string]).toBe(1_500_000);
    expect(analysis.body.resourceLoad[0].overAllocationDays).toHaveLength(5);
    expect(analysis.body.resourceLoad[0].overAllocationDays[0]).toEqual({
      date: "2026-10-19",
      totalPercent: 120,
    });
  });
});

describe("analisis proyek", () => {
  it("menghitung CPM, jalur kritis, dan diagram PERT", async () => {
    const a = await createTask(app, token, projectId, { name: "A", durationDays: 3, startDate: PROJECT_START });
    const b = await createTask(app, token, projectId, { name: "B", durationDays: 2, startDate: PROJECT_START });
    const c = await createTask(app, token, projectId, {
      name: "C",
      durationDays: 5,
      startDate: PROJECT_START,
      optimisticDays: 4,
      pessimisticDays: 8,
    });
    const d = await createTask(app, token, projectId, { name: "D", durationDays: 1, startDate: PROJECT_START });

    for (const [successor, predecessor] of [
      [b, a],
      [c, a],
      [d, b],
      [d, c],
    ] as [Record<string, unknown>, Record<string, unknown>][]) {
      const response = await request(app)
        .post(`/api/tasks/${String(successor.id)}/dependencies`)
        .set(bearer(token))
        .send({ predecessorId: predecessor.id, type: "FS", lagDays: 0 });
      expect(response.status).toBe(201);
    }

    const response = await request(app)
      .get(`/api/projects/${projectId}/analysis`)
      .set(bearer(token));

    expect(response.status).toBe(200);
    const { summary, cpm, criticalPath, pert } = response.body;
    expect(summary).toMatchObject({
      startDate: "2026-10-19",
      endDate: "2026-10-29",
      totalWorkingDays: 9,
      criticalCount: 3,
    });

    const nodeB = cpm.find((node: { taskId: string }) => node.taskId === b.id);
    expect(nodeB).toMatchObject({ es: 3, ef: 4, totalFloat: 3, critical: false });

    const nodeC = cpm.find((node: { taskId: string }) => node.taskId === c.id);
    expect(nodeC).toMatchObject({ es: 3, ef: 7, totalFloat: 0, critical: true });

    const criticalNames = criticalPath.map(
      (id: string) => cpm.find((node: { taskId: string }) => node.taskId === id).name,
    );
    expect(criticalNames).toEqual(["A", "C", "D"]);

    const pertC = pert.nodes.find((node: { taskId: string }) => node.taskId === c.id);
    expect(pertC).toMatchObject({ critical: true, te: 5.33, column: 1 });
    expect(pert.criticalStdDev).toBeGreaterThan(0);
    expect(pert.edges).toHaveLength(4);
  });

  it("mengembalikan ringkasan kosong untuk proyek tanpa tugas", async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/analysis`)
      .set(bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ startDate: null, endDate: null, totalCost: 0 });
    expect(response.body.cpm).toEqual([]);
    expect(response.body.criticalPath).toEqual([]);
  });

  it("memakai jadwal terbaru setelah drag tanggal mulai", async () => {
    const task = await createTask(app, token, projectId, {
      name: "Geser",
      durationDays: 3,
      startDate: PROJECT_START,
    });
    const moved = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(bearer(token))
      .send({ startDate: "2026-10-26" });

    expect(moved.status).toBe(200);
    expect(findTask(moved.body.tasks, task.id)).toMatchObject({
      scheduledStart: "2026-10-26",
      scheduledEnd: "2026-10-28",
    });

    const analysis = await request(app)
      .get(`/api/projects/${projectId}/analysis`)
      .set(bearer(token));
    expect(analysis.body.summary.startDate).toBe("2026-10-26");
  });
});
