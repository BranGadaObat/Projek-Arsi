import { Router } from "express";
import { resourceCreateSchema, resourceUpdateSchema } from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { getOwnedProject, getOwnedResource, serializeResource } from "../services/snapshot.js";

export const resourcesRouter = Router();

resourcesRouter.get(
  "/projects/:id/resources",
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, currentUserId(req));
    const resources = await prisma.resource.findMany({
      where: { projectId: project.id },
      orderBy: { name: "asc" },
    });
    res.json({ resources: resources.map(serializeResource) });
  }),
);

resourcesRouter.post(
  "/projects/:id/resources",
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, currentUserId(req));
    const body = parseBody(resourceCreateSchema, req.body);
    const resource = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: body.name,
        email: body.email,
        role: body.role,
        salary: body.salary,
      },
    });
    res.status(201).json({ resource: serializeResource(resource) });
  }),
);

resourcesRouter.patch(
  "/resources/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const resource = await getOwnedResource(req.params.id, userId);
    const body = parseBody(resourceUpdateSchema, req.body);
    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.salary !== undefined ? { salary: body.salary } : {}),
      },
    });
    res.json({ resource: serializeResource(updated) });
  }),
);

resourcesRouter.delete(
  "/resources/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const resource = await getOwnedResource(req.params.id, userId);
    const deleted = await prisma.resource.deleteMany({
      where: { id: resource.id, project: { ownerId: userId } },
    });
    if (deleted.count === 0) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Anggota tim tidak ditemukan.");
    }
    res.json({ ok: true });
  }),
);
