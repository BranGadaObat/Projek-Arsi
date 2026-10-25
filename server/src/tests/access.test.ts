import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";
import {
  PROJECT_START,
  bearer,
  createProject,
  createTask,
  registerUser,
  resetDb,
} from "./helpers.js";

let app: Express;
let ownerToken: string;
let otherToken: string;
let projectId: string;
let taskId: string;
let resourceId: string;
let dependencyId: string;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  ownerToken = (await registerUser(app, "pemilik@example.com")).token;
  otherToken = (await registerUser(app, "lain@example.com")).token;
  const project = await createProject(app, ownerToken);
  projectId = project.id as string;

  const first = await createTask(app, ownerToken, projectId, { name: "A", startDate: PROJECT_START });
  const second = await createTask(app, ownerToken, projectId, { name: "B", startDate: PROJECT_START });
  taskId = first.id as string;
  const dependency = await request(app)
    .post(`/api/tasks/${String(second.id)}/dependencies`)
    .set(bearer(ownerToken))
    .send({ predecessorId: first.id, type: "FS", lagDays: 0 });
  dependencyId = dependency.body.dependency.id as string;

  const resource = await request(app)
    .post(`/api/projects/${projectId}/resources`)
    .set(bearer(ownerToken))
    .send({ name: "Andi", email: "andi@example.com", role: "PM", salary: 15_000_000 });
  resourceId = resource.body.resource.id as string;
});

describe("isolasi data antar pengguna", () => {
  it("pengguna lain tidak melihat proyek pada daftar", async () => {
    const response = await request(app).get("/api/projects").set(bearer(otherToken));
    expect(response.status).toBe(200);
    expect(response.body.projects).toEqual([]);
  });

  it("pengguna lain mendapat 404 untuk detail proyek dan analisis", async () => {
    const detail = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(bearer(otherToken));
    expect(detail.status).toBe(404);

    const analysis = await request(app)
      .get(`/api/projects/${projectId}/analysis`)
      .set(bearer(otherToken));
    expect(analysis.status).toBe(404);
  });

  it("pengguna lain tidak bisa mengubah atau menghapus data", async () => {
    const patchTask = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(bearer(otherToken))
      .send({ name: "Dibajak" });
    expect(patchTask.status).toBe(404);

    const deleteTask = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(bearer(otherToken));
    expect(deleteTask.status).toBe(404);

    const createChild = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(bearer(otherToken))
      .send({ name: "Baru", durationDays: 1, startDate: PROJECT_START });
    expect(createChild.status).toBe(404);

    const deleteProject = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set(bearer(otherToken));
    expect(deleteProject.status).toBe(404);

    const patchResource = await request(app)
      .patch(`/api/resources/${resourceId}`)
      .set(bearer(otherToken))
      .send({ salary: 1 });
    expect(patchResource.status).toBe(404);

    const patchDependency = await request(app)
      .patch(`/api/dependencies/${dependencyId}`)
      .set(bearer(otherToken))
      .send({ lagDays: 5 });
    expect(patchDependency.status).toBe(404);

    const calendar = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(bearer(otherToken))
      .send({ weekendDays: [5, 6] });
    expect(calendar.status).toBe(404);
  });

  it("tanpa token semua rute data ditolak 401", async () => {
    const response = await request(app).get("/api/projects");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("data pemilik tetap utuh setelah percobaan akses", async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(bearer(ownerToken));
    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(2);
    expect(response.body.project.name).toBe("Proyek Uji");
  });
});
