import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { dependenciesRouter } from "./routes/dependencies.js";
import { resourcesRouter } from "./routes/resources.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { calendarRouter } from "./routes/calendar.js";
import { analysisRouter } from "./routes/analysis.js";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.isTest ? true : ["http://localhost:5173", "http://127.0.0.1:5173"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/projects", requireAuth, projectsRouter);
  app.use(
    "/api",
    requireAuth,
    tasksRouter,
    dependenciesRouter,
    resourcesRouter,
    assignmentsRouter,
    calendarRouter,
    analysisRouter,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
