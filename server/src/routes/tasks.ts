import { Router } from "express";
import { taskCreateSchema, taskMoveSchema, taskUpdateSchema } from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { getOwnedProject, getOwnedTask, serializeTask } from "../services/snapshot.js";
import { descendantIds, recomputeProject, taskDepth } from "../services/recompute.js";

export const tasksRouter = Router();

const EDITABLE_PARENT_FIELDS = ["name", "description", "color", "priority"] as const;

async function assertParentUsable(
  parentId: string,
  tasks: { id: string; parentId: string | null }[],
): Promise<void> {
  const parent = tasks.find((task) => task.id === parentId);
  if (!parent) {
    throw new AppError(422, "PARENT_NOT_FOUND", "Tugas induk tidak ditemukan pada proyek ini.");
  }
  const hasChildren = tasks.some((task) => task.parentId === parentId);
  if (!hasChildren) {
    const [dependencyCount, assignmentCount] = await Promise.all([
      prisma.dependency.count({
        where: { OR: [{ predecessorId: parentId }, { successorId: parentId }] },
      }),
      prisma.assignment.count({ where: { taskId: parentId } }),
    ]);
    if (dependencyCount > 0 || assignmentCount > 0) {
      throw new AppError(
        409,
        "PARENT_HAS_RELATIONS",
        "Tugas yang sudah punya dependensi atau alokasi tidak bisa dijadikan induk. Hapus dependensi dan alokasinya terlebih dahulu.",
      );
    }
  }
  if (taskDepth(tasks, parentId) + 1 > 3) {
    throw new AppError(422, "MAX_DEPTH_EXCEEDED", "Kedalaman sub-tugas maksimal 3 level.");
  }
}

tasksRouter.post(
  "/projects/:id/tasks",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(req.params.id, userId);
    const body = parseBody(taskCreateSchema, req.body);
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });

    const parentId = body.parentId ?? null;
    if (parentId) {
      await assertParentUsable(parentId, tasks);
    }

    const siblings = tasks.filter((task) => task.parentId === parentId);
    const position = siblings.length === 0 ? 0 : Math.max(...siblings.map((task) => task.position)) + 1;

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId,
        position,
        name: body.name,
        description: body.description ?? null,
        durationDays: body.durationDays,
        startDate: body.startDate,
        scheduledStart: body.startDate,
        scheduledEnd: body.startDate,
        priority: body.priority,
        color: body.color,
        progress: body.progress,
        optimisticDays: body.optimisticDays ?? null,
        pessimisticDays: body.pessimisticDays ?? null,
      },
    });

    const taskList = await recomputeProject(project.id);
    res.status(201).json({
      task: taskList.find((item) => item.id === created.id) ?? serializeTask(created),
      tasks: taskList,
    });
  }),
);

tasksRouter.patch(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(req.params.id, userId);
    const body = parseBody(taskUpdateSchema, req.body);
    const childrenCount = await prisma.task.count({ where: { parentId: task.id } });

    if (childrenCount > 0) {
      const forbidden = Object.keys(body).filter(
        (key) => !EDITABLE_PARENT_FIELDS.includes(key as (typeof EDITABLE_PARENT_FIELDS)[number]),
      );
      if (forbidden.length > 0) {
        throw new AppError(
          422,
          "TASK_PARENT_READONLY",
          "Pada tugas induk hanya nama, deskripsi, warna, dan prioritas yang dapat diubah.",
          { fields: forbidden },
        );
      }
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.durationDays !== undefined ? { durationDays: body.durationDays } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.progress !== undefined ? { progress: body.progress } : {}),
        ...(body.optimisticDays !== undefined ? { optimisticDays: body.optimisticDays ?? null } : {}),
        ...(body.pessimisticDays !== undefined ? { pessimisticDays: body.pessimisticDays ?? null } : {}),
      },
    });

    const taskList = await recomputeProject(project.id);
    res.json({ tasks: taskList });
  }),
);

tasksRouter.delete(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(req.params.id, userId);
    const allTasks = await prisma.task.findMany({ where: { projectId: project.id } });
    const ids = [task.id, ...descendantIds(allTasks, task.id)];
    const deleted = await prisma.task.deleteMany({ where: { id: { in: ids } } });
    if (deleted.count === 0) {
      throw new AppError(404, "TASK_NOT_FOUND", "Tugas tidak ditemukan.");
    }
    const taskList = await recomputeProject(project.id);
    res.json({ tasks: taskList });
  }),
);

tasksRouter.post(
  "/tasks/:id/move",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(req.params.id, userId);
    const body = parseBody(taskMoveSchema, req.body);
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    const newParentId = body.parentId ?? null;

    if (newParentId) {
      if (newParentId === task.id) {
        throw new AppError(422, "INVALID_PARENT", "Tugas tidak bisa menjadi induk bagi dirinya sendiri.");
      }
      if (descendantIds(tasks, task.id).includes(newParentId)) {
        throw new AppError(422, "INVALID_PARENT", "Tugas tidak bisa dipindahkan ke bawah keturunannya sendiri.");
      }
      await assertParentUsable(newParentId, tasks);
      const subtreeHeight = Math.max(
        1,
        ...[task.id, ...descendantIds(tasks, task.id)].map((id) => taskDepth(tasks, id) - taskDepth(tasks, task.id) + 1),
      );
      if (taskDepth(tasks, newParentId) + subtreeHeight > 3) {
        throw new AppError(422, "MAX_DEPTH_EXCEEDED", "Kedalaman sub-tugas maksimal 3 level.");
      }
    }

    const siblings = tasks
      .filter((item) => item.parentId === newParentId && item.id !== task.id)
      .sort((a, b) => a.position - b.position);
    const index = Math.min(Math.max(body.position, 0), siblings.length);
    siblings.splice(index, 0, task);

    await prisma.$transaction(
      siblings.map((item, order) =>
        prisma.task.update({
          where: { id: item.id },
          data: { position: order, ...(item.id === task.id ? { parentId: newParentId } : {}) },
        }),
      ),
    );

    const taskList = await recomputeProject(project.id);
    res.json({ tasks: taskList });
  }),
);
