import { Router } from "express";
import { dependencyCreateSchema, dependencyUpdateSchema } from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { getOwnedDependency, getOwnedTask, serializeDependency } from "../services/snapshot.js";
import { recomputeProject, wouldCreateCycle } from "../services/recompute.js";

export const dependenciesRouter = Router();

dependenciesRouter.post(
  "/tasks/:id/dependencies",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task: successor, project } = await getOwnedTask(req.params.id, userId);
    const body = parseBody(dependencyCreateSchema, req.body);

    if (body.predecessorId === successor.id) {
      throw new AppError(422, "SELF_DEPENDENCY", "Tugas tidak boleh bergantung pada dirinya sendiri.");
    }

    const predecessor = await prisma.task.findFirst({
      where: { id: body.predecessorId, projectId: project.id },
    });
    if (!predecessor) {
      throw new AppError(422, "PREDECESSOR_NOT_FOUND", "Tugas predecessor tidak ditemukan pada proyek ini.");
    }

    const [predecessorChildren, successorChildren] = await Promise.all([
      prisma.task.count({ where: { parentId: predecessor.id } }),
      prisma.task.count({ where: { parentId: successor.id } }),
    ]);
    if (predecessorChildren > 0 || successorChildren > 0) {
      throw new AppError(
        422,
        "PARENT_TASK_DEPENDENCY",
        "Dependensi hanya boleh antara tugas daun. Tugas induk tidak bisa diberi dependensi.",
      );
    }

    const existing = await prisma.dependency.findFirst({
      where: { predecessorId: predecessor.id, successorId: successor.id },
    });
    if (existing) {
      throw new AppError(409, "DUPLICATE_DEPENDENCY", "Dependensi antara kedua tugas ini sudah ada.");
    }

    const projectDependencies = await prisma.dependency.findMany({
      where: { predecessor: { projectId: project.id } },
      select: { predecessorId: true, successorId: true },
    });
    if (wouldCreateCycle(projectDependencies, predecessor.id, successor.id)) {
      throw new AppError(
        422,
        "CYCLE_DETECTED",
        "Dependensi ini akan membentuk siklus. Periksa kembali urutan tugas Anda.",
      );
    }

    const dependency = await prisma.dependency.create({
      data: {
        predecessorId: predecessor.id,
        successorId: successor.id,
        type: body.type,
        lagDays: body.lagDays,
      },
    });

    const taskList = await recomputeProject(project.id);
    res.status(201).json({ dependency: serializeDependency(dependency), tasks: taskList });
  }),
);

dependenciesRouter.patch(
  "/dependencies/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { dependency, project } = await getOwnedDependency(req.params.id, userId);
    const body = parseBody(dependencyUpdateSchema, req.body);

    const updated = await prisma.dependency.update({
      where: { id: dependency.id },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.lagDays !== undefined ? { lagDays: body.lagDays } : {}),
      },
    });

    const taskList = await recomputeProject(project.id);
    res.json({ dependency: serializeDependency(updated), tasks: taskList });
  }),
);

dependenciesRouter.delete(
  "/dependencies/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { dependency, project } = await getOwnedDependency(req.params.id, userId);
    const deleted = await prisma.dependency.deleteMany({ where: { id: dependency.id } });
    if (deleted.count === 0) {
      throw new AppError(404, "DEPENDENCY_NOT_FOUND", "Dependensi tidak ditemukan.");
    }
    const taskList = await recomputeProject(project.id);
    res.json({ tasks: taskList });
  }),
);
