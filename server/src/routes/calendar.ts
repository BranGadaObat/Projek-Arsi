import { Router } from "express";
import {
  calendarUpdateSchema,
  holidayCreateSchema,
  serializeWeekendDays,
} from "shared";
import { prisma } from "../db.js";
import { AppError } from "../middleware/error.js";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import {
  getOwnedHoliday,
  getOwnedProject,
  serializeHoliday,
} from "../services/snapshot.js";
import { recomputeProject } from "../services/recompute.js";

export const calendarRouter = Router();

calendarRouter.put(
  "/projects/:id/calendar",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(req.params.id, userId);
    const body = parseBody(calendarUpdateSchema, req.body);
    await prisma.project.update({
      where: { id: project.id },
      data: { weekendDays: serializeWeekendDays(body.weekendDays) },
    });
    const tasks = await recomputeProject(project.id);
    res.json({ tasks, weekendDays: serializeWeekendDays(body.weekendDays) });
  }),
);

calendarRouter.post(
  "/projects/:id/holidays",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(req.params.id, userId);
    const body = parseBody(holidayCreateSchema, req.body);

    const existing = await prisma.holiday.findFirst({
      where: { projectId: project.id, date: body.date },
    });
    if (existing) {
      throw new AppError(409, "DUPLICATE_HOLIDAY", "Hari libur pada tanggal tersebut sudah ada.");
    }

    const holiday = await prisma.holiday.create({
      data: { projectId: project.id, date: body.date, name: body.name },
    });
    const tasks = await recomputeProject(project.id);
    const holidays = await prisma.holiday.findMany({
      where: { projectId: project.id },
      orderBy: { date: "asc" },
    });
    res.status(201).json({ holiday: serializeHoliday(holiday), holidays: holidays.map(serializeHoliday), tasks });
  }),
);

calendarRouter.delete(
  "/holidays/:id",
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { holiday, project } = await getOwnedHoliday(req.params.id, userId);
    const deleted = await prisma.holiday.deleteMany({ where: { id: holiday.id } });
    if (deleted.count === 0) {
      throw new AppError(404, "HOLIDAY_NOT_FOUND", "Hari libur tidak ditemukan.");
    }
    const tasks = await recomputeProject(project.id);
    const holidays = await prisma.holiday.findMany({
      where: { projectId: project.id },
      orderBy: { date: "asc" },
    });
    res.json({ holidays: holidays.map(serializeHoliday), tasks });
  }),
);
