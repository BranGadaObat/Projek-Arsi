import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";
import { resetDb } from "./helpers.js";

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("auth", () => {
  it("mendaftarkan pengguna dan mengembalikan token", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti", email: "siti@example.com", password: "Password123" });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf("string");
    expect(response.body.user).toMatchObject({ name: "Siti", email: "siti@example.com" });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("menolak email duplikat dengan 409", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti", email: "siti@example.com", password: "Password123" });
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti Lain", email: "siti@example.com", password: "Password123" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("menolak kata sandi kurang dari 8 karakter", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti", email: "siti@example.com", password: "pendek" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.password).toBeDefined();
  });

  it("login benar mengembalikan token, login salah 401", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti", email: "siti@example.com", password: "Password123" });

    const ok = await request(app)
      .post("/api/auth/login")
      .send({ email: "siti@example.com", password: "Password123" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTypeOf("string");

    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "siti@example.com", password: "PasswordSalah" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /auth/me butuh token yang sah", async () => {
    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Siti", email: "siti@example.com", password: "Password123" });

    const unauthorized = await request(app).get("/api/auth/me");
    expect(unauthorized.status).toBe(401);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${register.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("siti@example.com");
  });

  it("health check tersedia tanpa token", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
