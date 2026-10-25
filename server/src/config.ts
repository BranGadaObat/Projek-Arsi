import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
// `.env` kanonik berada di root repository; `server/.env` opsional.
dotenv.config({ path: path.resolve(here, "../../.env") });
dotenv.config({ path: path.resolve(here, "../.env") });

const jwtSecret = process.env.JWT_SECRET?.trim();

if (!jwtSecret) {
  throw new Error(
    "JWT_SECRET belum diisi. Salin .env.example menjadi .env di root proyek lalu isi JWT_SECRET dengan string acak.",
  );
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret,
  jwtExpiresIn: "7d" as const,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isTest: process.env.NODE_ENV === "test",
};
