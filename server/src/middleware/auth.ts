import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "./error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(new AppError(401, "UNAUTHENTICATED", "Anda harus masuk terlebih dahulu."));
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    next(new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali."));
    return;
  }
  const userId = typeof payload === "string" ? null : payload.sub;
  if (!userId) {
    next(new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid. Silakan masuk kembali."));
    return;
  }
  prisma.user
    .findUnique({ where: { id: userId }, select: { id: true } })
    .then((user) => {
      if (!user) {
        next(new AppError(401, "UNAUTHENTICATED", "Akun tidak ditemukan. Silakan masuk kembali."));
        return;
      }
      req.userId = user.id;
      next();
    })
    .catch(next);
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function currentUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError(401, "UNAUTHENTICATED", "Anda harus masuk terlebih dahulu.");
  }
  return req.userId;
}
