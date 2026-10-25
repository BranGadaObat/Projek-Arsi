import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Endpoint tidak ditemukan.", details: {} },
  });
}

function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    details[key] = [...(details[key] ?? []), issue.message];
  }
  return details;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? {} },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Data yang dikirim tidak valid.",
        details: zodDetails(error),
      },
    });
    return;
  }

  const maybeSyntax = error as { type?: string } | null;
  if (maybeSyntax?.type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Body permintaan bukan JSON yang valid.", details: {} },
    });
    return;
  }

  if (!config.isTest) {
    console.error("Kesalahan server:", error);
  }
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server. Coba lagi beberapa saat.",
      details: {},
    },
  });
}
