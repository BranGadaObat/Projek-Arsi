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
  const project = await createProject(app, token, { startDate: PROJECT_START });
  projectId = project.id as string;
});

async function addDependency(
  successorId: unknown,
  predecessorId: unknown,
  type: "FS" | "SS",
  lagDays = 0,
) {
  return request(app)
    .post(`/api/tasks/${String(successorId)}/dependencies`)
    .set(bearer(token))
    .send({ predecessorId, type, lagDays });
}

describe("dependensi", () => {
  it("FS lag 0: penerus mulai hari kerja setelah predecessor selesai", async () => {
    const predecessor = await createTask(app, token, projectId, {
      name: "Pred",
      startDate: "2026-10-23",
      durationDays: 3,
    });
    const successor = await createTask(app, token, projectId, {
      name: "Succ",
      startDate: "2026-10-01",
      durationDays: 2,
    });

    const response = await addDependency(successor.id, predecessor.id, "FS", 0);
    expect(response.status).toBe(201);
    const updated = findTask(response.body.tasks, successor.id);
    expect(updated.scheduledStart).toBe("2026-10-28");
  });

  it("SS lag 2: penerus mulai dua hari kerja setelah predecessor mulai", async () => {
    const predecessor = await createTask(app, token, projectId, {
      name: "Pred",
      startDate: "2026-10-23",
      durationDays: 3,
    });
    const successor = await createTask(app, token, projectId, {
      name: "Succ",
      startDate: "2026-10-01",
      durationDays: 2,
    });

    const response = await addDependency(successor.id, predecessor.id, "SS", 2);
    expect(response.status).toBe(201);
    expect(findTask(response.body.tasks, successor.id).scheduledStart).toBe("2026-10-27");
  });

  it("mengubah tipe dan lag dependensi memindahkan bar", async () => {
    const predecessor = await createTask(app, token, projectId, {
      name: "Pred",
      startDate: "2026-10-19",
      durationDays: 3,
    });
    const successor = await createTask(app, token, projectId, {
      name: "Succ",
      startDate: "2026-10-05",
      durationDays: 2,
    });

    const created = await addDependency(successor.id, predecessor.id, "FS", 0);
    const dependencyId = created.body.dependency.id as string;
    expect(findTask(created.body.tasks, successor.id).scheduledStart).toBe("2026-10-22");

    const patched = await request(app)
      .patch(`/api/dependencies/${dependencyId}`)
      .set(bearer(token))
      .send({ lagDays: 3 });
    expect(patched.status).toBe(200);
    expect(findTask(patched.body.tasks, successor.id).scheduledStart).toBe("2026-10-27");

    const removed = await request(app)
      .delete(`/api/dependencies/${dependencyId}`)
      .set(bearer(token));
    expect(removed.status).toBe(200);
    expect(findTask(removed.body.tasks, successor.id).scheduledStart).toBe("2026-10-05");
  });

  it("menolak dependensi pada diri sendiri, duplikat, dan tugas induk", async () => {
    const first = await createTask(app, token, projectId, { name: "A" });
    const second = await createTask(app, token, projectId, { name: "B" });

    const self = await addDependency(first.id, first.id, "FS");
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe("SELF_DEPENDENCY");

    await addDependency(second.id, first.id, "FS");
    const duplicate = await addDependency(second.id, first.id, "SS", 1);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_DEPENDENCY");

    const parent = await createTask(app, token, projectId, { name: "Induk" });
    await createTask(app, token, projectId, { name: "Anak", parentId: parent.id as string });
    const parentDependency = await addDependency(parent.id, second.id, "FS");
    expect(parentDependency.status).toBe(422);
    expect(parentDependency.body.error.code).toBe("PARENT_TASK_DEPENDENCY");
  });

  it("menolak dependensi yang membentuk siklus", async () => {
    const a = await createTask(app, token, projectId, { name: "A" });
    const b = await createTask(app, token, projectId, { name: "B" });
    const c = await createTask(app, token, projectId, { name: "C" });

    expect((await addDependency(b.id, a.id, "FS")).status).toBe(201);
    expect((await addDependency(c.id, b.id, "FS")).status).toBe(201);

    const cycle = await addDependency(a.id, c.id, "FS");
    expect(cycle.status).toBe(422);
    expect(cycle.body.error.code).toBe("CYCLE_DETECTED");
    expect(cycle.body.error.message).toContain("siklus");
  });

  it("mengembalikan daftar tugas lengkap setiap mutasi", async () => {
    const first = await createTask(app, token, projectId, { name: "A", durationDays: 2 });
    const second = await createTask(app, token, projectId, { name: "B", durationDays: 2 });
    await createTask(app, token, projectId, { name: "C", durationDays: 2 });

    const response = await addDependency(second.id, first.id, "FS");
    expect(Array.isArray(response.body.tasks)).toBe(true);
    expect(response.body.tasks).toHaveLength(3);
  });
});
