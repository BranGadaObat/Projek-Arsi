import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Membuat ulang database uji (server/prisma/test.db) dari schema Prisma. */
export default function setup(): void {
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--schema", "prisma/schema.prisma", "--force-reset", "--skip-generate"],
    {
      cwd: serverDir,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
    },
  );
}
