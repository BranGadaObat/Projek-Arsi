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
let taskId: string;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  const user = await registerUser(app);
  token = user.token;
  const project = await createProject(app, token);
  projectId = project.id as string;
  const task = await createTask(app, token, projectId, {
    name: "Pengembangan",
    startDate: PROJECT_START,
    durationDays: 5,
  });
  taskId = task.id as string;
});

describe("kalender proyek", () => {
  it("durasi tidak menghitung akhir pekan", async () => {
    const task = await createTask(app, token, projectId, {
      startDate: "2026-10-23",
      durationDays: 3,
    });
    expect(task.scheduledEnd).toBe("2026-10-27");
  });

  it("mengubah akhir pekan menggeser jadwal", async () => {
    const defaultTask = await createTask(app, token, projectId, {
      name: "Lima hari",
      startDate: PROJECT_START,
      durationDays: 5,
    });
    expect(defaultTask.scheduledEnd).toBe("2026-10-23");

    const response = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(bearer(token))
      .send({ weekendDays: [5, 6] });

    expect(response.status).toBe(200);
    expect(response.body.weekendDays).toBe("5,6");
    expect(findTask(response.body.tasks, defaultTask.id).scheduledEnd).toBe("2026-10-25");
  });

  it("menambah dan menghapus hari libur menggeser jadwal", async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(bearer(token))
      .send({ date: "2026-10-20", name: "Libur internal" });

    expect(response.status).toBe(201);
    expect(response.body.holidays).toHaveLength(1);
    expect(findTask(response.body.tasks, taskId).scheduledEnd).toBe("2026-10-26");

    const duplicate = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(bearer(token))
      .send({ date: "2026-10-20", name: "Libur ganda" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_HOLIDAY");

    const removed = await request(app)
      .delete(`/api/holidays/${response.body.holiday.id}`)
      .set(bearer(token));
    expect(removed.status).toBe(200);
    expect(removed.body.holidays).toHaveLength(0);
    expect(findTask(removed.body.tasks, taskId).scheduledEnd).toBe("2026-10-23");
  });

  it("menolak akhir pekan yang berisi tujuh hari", async () => {
    const response = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(bearer(token))
      .send({ weekendDays: [0, 1, 2, 3, 4, 5, 6] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("menolak hari libur dengan tanggal tidak valid", async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(bearer(token))
      .send({ date: "2026-02-30", name: "Tanggal salah" });

    expect(response.status).toBe(422);
  });
});
