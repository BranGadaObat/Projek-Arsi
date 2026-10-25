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
  findTaskByName,
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

describe("tugas", () => {
  it("menambah tugas dengan durasi, tanggal, prioritas, dan warna", async () => {
    const task = await createTask(app, token, projectId, {
      name: "Analisis kebutuhan",
      durationDays: 4,
      startDate: "2026-10-21",
      priority: "HIGH",
      color: "#DB2777",
    });

    expect(task).toMatchObject({
      name: "Analisis kebutuhan",
      durationDays: 4,
      startDate: "2026-10-21",
      priority: "HIGH",
      color: "#DB2777",
      progress: 0,
    });
  });

  it("mengubah tugas dan menghitung ulang jadwal", async () => {
    const task = await createTask(app, token, projectId, { durationDays: 3 });
    expect(task.scheduledEnd).toBe("2026-10-21");

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(bearer(token))
      .send({ durationDays: 5, priority: "LOW", progress: 40, color: "#0D9488" });

    expect(response.status).toBe(200);
    const updated = findTask(response.body.tasks, task.id);
    expect(updated).toMatchObject({
      durationDays: 5,
      priority: "LOW",
      progress: 40,
      color: "#0D9488",
      scheduledStart: PROJECT_START,
      scheduledEnd: "2026-10-23",
    });
  });

  it("menghapus tugas beserta anaknya", async () => {
    const parent = await createTask(app, token, projectId, { name: "Induk" });
    const child = await createTask(app, token, projectId, {
      name: "Anak",
      parentId: parent.id as string,
    });

    const response = await request(app)
      .delete(`/api/tasks/${parent.id}`)
      .set(bearer(token));

    expect(response.status).toBe(200);
    const ids = (response.body.tasks as { id: string }[]).map((item) => item.id);
    expect(ids).not.toContain(parent.id);
    expect(ids).not.toContain(child.id);
  });

  it("menghitung rentang, durasi, dan progres tugas induk dari anak", async () => {
    const parent = await createTask(app, token, projectId, { name: "Fase" });
    await createTask(app, token, projectId, {
      name: "Anak A",
      parentId: parent.id as string,
      startDate: "2026-10-19",
      durationDays: 2,
      progress: 100,
    });
    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(token))
      .send({
        name: "Anak B",
        parentId: parent.id,
        startDate: "2026-10-26",
        durationDays: 4,
        progress: 0,
      });

    expect(response.status).toBe(201);
    const parentTask = findTask(response.body.tasks, parent.id);
    expect(parentTask).toMatchObject({
      scheduledStart: "2026-10-19",
      scheduledEnd: "2026-10-29",
      durationDays: 9,
      progress: 33,
    });
  });

  it("menolak perubahan kolom terhitung pada tugas induk", async () => {
    const parent = await createTask(app, token, projectId, { name: "Fase" });
    await createTask(app, token, projectId, {
      name: "Anak",
      parentId: parent.id as string,
      durationDays: 2,
    });

    const rejected = await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(bearer(token))
      .send({ durationDays: 10 });

    expect(rejected.status).toBe(422);
    expect(rejected.body.error.code).toBe("TASK_PARENT_READONLY");

    const allowed = await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(bearer(token))
      .send({ name: "Fase Baru", color: "#2563EB" });
    expect(allowed.status).toBe(200);
    expect(findTask(allowed.body.tasks, parent.id).name).toBe("Fase Baru");
  });

  it("membatasi kedalaman sub-tugas maksimal 3 level", async () => {
    const level1 = await createTask(app, token, projectId, { name: "L1" });
    const level2 = await createTask(app, token, projectId, {
      name: "L2",
      parentId: level1.id as string,
    });
    await createTask(app, token, projectId, {
      name: "L3",
      parentId: level2.id as string,
    });
    const tooDeep = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(token))
      .send({ name: "L4", parentId: (level2.id as string), durationDays: 1, startDate: PROJECT_START });
    // L4 akan menjadi level 3 di bawah L2, masih diizinkan; yang ditolak adalah level 4.
    expect(tooDeep.status).toBe(201);

    const l3 = findTaskByName(tooDeep.body.tasks as Record<string, unknown>[], "L3");
    const overflow = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(token))
      .send({ name: "L5", parentId: l3.id, durationDays: 1, startDate: PROJECT_START });

    expect(overflow.status).toBe(422);
    expect(overflow.body.error.code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("menolak menambah anak pada tugas yang punya dependensi atau alokasi", async () => {
    const first = await createTask(app, token, projectId, { name: "Pertama" });
    const second = await createTask(app, token, projectId, { name: "Kedua" });
    await request(app)
      .post(`/api/tasks/${second.id}/dependencies`)
      .set(bearer(token))
      .send({ predecessorId: first.id, type: "FS", lagDays: 0 });

    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(token))
      .send({ name: "Anak", parentId: first.id, durationDays: 1, startDate: PROJECT_START });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PARENT_HAS_RELATIONS");

    const resourceResponse = await request(app)
      .post(`/api/projects/${projectId}/resources`)
      .set(bearer(token))
      .send({ name: "Rina", email: "rina@example.com", role: "Analis", salary: 8_000_000 });
    await request(app)
      .post(`/api/tasks/${second.id}/assignments`)
      .set(bearer(token))
      .send({ resourceId: resourceResponse.body.resource.id, allocationPercent: 100 });

    const withAssignment = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(token))
      .send({ name: "Anak Lagi", parentId: second.id, durationDays: 1, startDate: PROJECT_START });
    expect(withAssignment.status).toBe(409);
  });

  it("memindahkan tugas ke induk dan urutan baru", async () => {
    const parent = await createTask(app, token, projectId, { name: "Induk" });
    const leaf = await createTask(app, token, projectId, { name: "Daun" });

    const response = await request(app)
      .post(`/api/tasks/${leaf.id}/move`)
      .set(bearer(token))
      .send({ parentId: parent.id, position: 0 });

    expect(response.status).toBe(200);
    const moved = findTask(response.body.tasks, leaf.id);
    expect(moved.parentId).toBe(parent.id);
    expect(moved.position).toBe(0);
    expect(findTask(response.body.tasks, parent.id).scheduledEnd).toBeTypeOf("string");
  });
});
