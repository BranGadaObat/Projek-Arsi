import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { loginSchema, registerSchema } from "shared";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId, requireAuth, signToken } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
      details: {},
    },
  },
});

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new AppError(409, "EMAIL_TAKEN", "Email sudah terdaftar. Gunakan email lain atau masuk.");
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash },
    });
    res.status(201).json({
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email },
    });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const valid = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.");
    }
    res.json({
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId(req) },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Akun tidak ditemukan.");
    }
    res.json({ user: { ...user, createdAt: user.createdAt.toISOString() } });
  }),
);
