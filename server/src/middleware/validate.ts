import type { z } from "zod";
import { AppError } from "./error.js";

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_";
      details[key] = [...(details[key] ?? []), issue.message];
    }
    throw new AppError(422, "VALIDATION_ERROR", "Data yang dikirim tidak valid.", details);
  }
  return result.data;
}
