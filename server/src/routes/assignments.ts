import { Router } from "express";
import { assignmentCreateSchema, assignmentUpdateSchema } from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { getOwnedAssignment, getOwnedTask, serializeAssignment } from "../services/snapshot.js";

export const assignmentsRouter = Router();

assignmentsRouter.post(
  "/tasks/:id/assignments",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(req.params.id, userId);
    const body = parseBody(assignmentCreateSchema, req.body);

    const childrenCount = await prisma.task.count({ where: { parentId: task.id } });
    if (childrenCount > 0) {
      throw new AppError(
        422,
        "PARENT_TASK_ASSIGNMENT",
        "Alokasi hanya untuk tugas daun. Tugas induk mengikuti alokasi anaknya.",
      );
    }

    const resource = await prisma.resource.findFirst({
      where: { id: body.resourceId, projectId: project.id },
    });
    if (!resource) {
      throw new AppError(422, "RESOURCE_NOT_FOUND", "Anggota tim tidak ditemukan pada proyek ini.");
    }

    const existing = await prisma.assignment.findFirst({
      where: { taskId: task.id, resourceId: resource.id },
    });
    if (existing) {
      throw new AppError(409, "DUPLICATE_ASSIGNMENT", "Anggota ini sudah dialokasikan pada tugas tersebut.");
    }

    const assignment = await prisma.assignment.create({
      data: {
        taskId: task.id,
        resourceId: resource.id,
        allocationPercent: body.allocationPercent,
      },
    });
    res.status(201).json({ assignment: serializeAssignment(assignment) });
  }),
);

assignmentsRouter.patch(
  "/assignments/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { assignment } = await getOwnedAssignment(req.params.id, userId);
    const body = parseBody(assignmentUpdateSchema, req.body);
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { allocationPercent: body.allocationPercent },
    });
    res.json({ assignment: serializeAssignment(updated) });
  }),
);

assignmentsRouter.delete(
  "/assignments/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { assignment } = await getOwnedAssignment(req.params.id, userId);
    const deleted = await prisma.assignment.deleteMany({ where: { id: assignment.id } });
    if (deleted.count === 0) {
      throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Alokasi tidak ditemukan.");
    }
    res.json({ ok: true });
  }),
);
