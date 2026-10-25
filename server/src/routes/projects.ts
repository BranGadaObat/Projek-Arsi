import { Router } from "express";
import { projectCreateSchema, projectUpdateSchema, serializeWeekendDays } from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { getOwnedProject, getSnapshot, serializeProject } from "../services/snapshot.js";
import { recomputeProject } from "../services/recompute.js";

export const projectsRouter = Router();

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { ownerId: currentUserId(req) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tasks: true, resources: true } } },
    });
    res.json({
      projects: projects.map((project) => ({
        ...serializeProject(project),
        taskCount: project._count.tasks,
        resourceCount: project._count.resources,
      })),
    });
  }),
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(projectCreateSchema, req.body);
    const project = await prisma.project.create({
      data: {
        ownerId: currentUserId(req),
        name: body.name,
        description: body.description ?? null,
        startDate: body.startDate,
        weekendDays: serializeWeekendDays(body.weekendDays ?? [0, 6]),
      },
    });
    res.status(201).json({ project: serializeProject(project) });
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const snapshot = await getSnapshot(req.params.id, currentUserId(req));
    res.json(snapshot);
  }),
);

projectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(req.params.id, userId);
    const body = parseBody(projectUpdateSchema, req.body);
    const calendarChanged =
      body.weekendDays !== undefined || (body.startDate !== undefined && body.startDate !== project.startDate);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.weekendDays !== undefined
          ? { weekendDays: serializeWeekendDays(body.weekendDays) }
          : {}),
      },
    });

    if (calendarChanged) {
      await recomputeProject(project.id);
    }
    const snapshot = await getSnapshot(project.id, userId);
    res.json(snapshot);
  }),
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(req.params.id, userId);
    const deleted = await prisma.project.deleteMany({ where: { id: project.id, ownerId: userId } });
    if (deleted.count === 0) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Proyek tidak ditemukan.");
    }
    res.json({ ok: true });
  }),
);
