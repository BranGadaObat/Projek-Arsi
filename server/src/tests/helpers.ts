import type { Express } from "express";
import request from "supertest";
import { prisma } from "../db.js";

export const PROJECT_START = "2026-10-19";

export async function resetDb(): Promise<void> {
  await prisma.assignment.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(
  app: Express,
  email = "pengguna@example.com",
  password = "Password123",
): Promise<{ token: string; userId: string }> {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ name: "Pengguna Uji", email, password });
  if (response.status !== 201) {
    throw new Error(`Registrasi gagal: ${JSON.stringify(response.body)}`);
  }
  return { token: response.body.token as string, userId: response.body.user.id as string };
}

export async function createProject(
  app: Express,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post("/api/projects")
    .set(bearer(token))
    .send({
      name: "Proyek Uji",
      startDate: PROJECT_START,
      weekendDays: [0, 6],
      ...overrides,
    });
  if (response.status !== 201) {
    throw new Error(`Buat proyek gagal: ${JSON.stringify(response.body)}`);
  }
  return response.body.project as Record<string, unknown>;
}

export interface TaskOverrides {
  name?: string;
  durationDays?: number;
  startDate?: string;
  parentId?: string | null;
  priority?: string;
  color?: string;
  progress?: number;
  optimisticDays?: number | null;
  pessimisticDays?: number | null;
}

export async function createTask(
  app: Express,
  token: string,
  projectId: string,
  overrides: TaskOverrides = {},
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(bearer(token))
    .send({
      name: "Tugas Uji",
      durationDays: 3,
      startDate: PROJECT_START,
      ...overrides,
    });
  if (response.status !== 201) {
    throw new Error(`Buat tugas gagal: ${JSON.stringify(response.body)}`);
  }
  return response.body.task as Record<string, unknown>;
}

type Token = Record<string, unknown>;

export function findTask(tasks: Token[], id: unknown): Token {
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error(`Tugas ${String(id)} tidak ada pada respons.`);
  return task;
}

export function findTaskByName(tasks: Token[], name: string): Token {
  const task = tasks.find((item) => item.name === name);
  if (!task) throw new Error(`Tugas bernama ${name} tidak ada pada respons.`);
  return task;
}
